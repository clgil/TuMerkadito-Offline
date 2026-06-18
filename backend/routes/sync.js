const express = require('express');
const path = require('path');
const db = require('../database');
const archiver = require('archiver');
const fs = require('fs');
const { authMiddleware, canViewFinancialReports, canCloseOthersTurns } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/v1/sync/pendientes
 * Listar ventas pendientes de sincronización con la nube
 */
router.get('/pendientes', authMiddleware, (req, res) => {
  try {
    const decoded = req.user;
    
    // Solo admin o dueño pueden ver pendientes de sincronización
    if (!['admin', 'dueño'].includes(decoded.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para ver sincronización' });
    }
    
    const pendientes = db.prepare(`
      SELECT v.*, u.nombre as vendedor_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE v.empresa_id = ? AND v.sync_status = 'pending'
      ORDER BY v.fecha ASC
      LIMIT 100
    `).all(decoded.empresa_id);
    
    res.json(pendientes);
  } catch (error) {
    console.error('Error al listar pendientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/sync/exportar
 * Exportar datos a archivo ZIP para respaldo
 */
router.post('/exportar', authMiddleware, (req, res) => {
  try {
    const decoded = req.user;
    
    // Solo admin o dueño pueden exportar
    if (!['admin', 'dueño'].includes(decoded.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para exportar datos' });
    }
    
    const fecha = new Date().toISOString().split('T')[0];
    const filename = `respaldo_merkadito_${fecha}.zip`;
    const backupDir = path.join(__dirname, '..', 'backups');
    
    // Crear directorio de backups si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filepath = path.join(backupDir, filename);
    
    // Crear archivo ZIP
    const output = fs.createWriteStream(filepath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      res.download(filepath, filename, (err) => {
        if (err) {
          console.error('Error al descargar:', err);
        }
        // Eliminar archivo después de descargar
        setTimeout(() => {
          fs.unlinkSync(filepath);
        }, 1000);
      });
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    
    // Agregar base de datos
    const dbPath = path.join(__dirname, '..', 'data', 'merkadito.db');
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'merkadito.db' });
    }
    
    // Agregar archivos WAL si existen
    const walPath = dbPath + '-wal';
    if (fs.existsSync(walPath)) {
      archive.file(walPath, { name: 'merkadito.db-wal' });
    }
    
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(shmPath)) {
      archive.file(shmPath, { name: 'merkadito.db-shm' });
    }
    
    // Exportar datos importantes como CSV
    const csvDir = path.join(backupDir, 'csv_temp');
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }
    
    // Exportar productos a CSV
    const productos = db.prepare('SELECT * FROM productos WHERE empresa_id = ?').all(decoded.empresa_id);
    const productosCsv = 'id,codigo,nombre,unidad,stock_actual,stock_minimo,costo,precio,proveedor,activo\n' +
      productos.map(p => `${p.id},"${p.codigo || ''}","${p.nombre}",${p.unidad},${p.stock_actual},${p.stock_minimo},${p.costo},${p.precio},"${p.proveedor || ''}",${p.activo}`).join('\n');
    fs.writeFileSync(path.join(csvDir, 'productos.csv'), productosCsv);
    archive.directory(csvDir, 'csv');
    
    // Exportar ventas del mes
    const ventas = db.prepare(`
      SELECT * FROM ventas 
      WHERE empresa_id = ? AND DATE(fecha) >= DATE('now', '-30 days')
    `).all(decoded.empresa_id);
    const ventasCsv = 'id,turno_id,vendedor_id,fecha,total,metodo_pago,efectivo_recibido,cambio,estado\n' +
      ventas.map(v => `${v.id},${v.turno_id || ''},${v.vendedor_id},"${v.fecha}",${v.total},${v.metodo_pago},${v.efectivo_recibido},${v.cambio},${v.estado}`).join('\n');
    fs.writeFileSync(path.join(csvDir, 'ventas.csv'), ventasCsv);
    
    // Limpiar directorio temporal
    fs.rmSync(csvDir, { recursive: true, force: true });
    
    archive.finalize();
  } catch (error) {
    console.error('Error al exportar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/v1/reportes/ventas
 * Reporte de ventas por período
 */
router.get('/reportes/ventas', authMiddleware, (req, res) => {
  try {
    const decoded = req.user;
    
    // Verificar permisos para ver reportes financieros
    if (!canViewFinancialReports(decoded)) {
      return res.status(403).json({ error: 'No tiene permisos para ver reportes financieros' });
    }
    
    const { fecha_desde, fecha_hasta, agrupar_por = 'dia' } = req.query;
    
    let groupFormat = '%Y-%m-%d'; // día
    if (agrupar_por === 'mes') {
      groupFormat = '%Y-%m';
    } else if (agrupar_por === 'semana') {
      groupFormat = '%Y-%W';
    }
    
    const query = `
      SELECT 
        strftime('${groupFormat}', fecha) as periodo,
        COUNT(*) as cantidad_ventas,
        SUM(total) as total_ventas,
        SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END) as total_efectivo,
        SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END) as total_transferencia,
        AVG(total) as promedio_venta
      FROM ventas
      WHERE empresa_id = ? AND estado = 'completada'
      ${fecha_desde ? "AND DATE(fecha) >= ?" : ""}
      ${fecha_hasta ? "AND DATE(fecha) <= ?" : ""}
      GROUP BY periodo
      ORDER BY periodo DESC
    `;
    
    const params = [decoded.empresa_id];
    if (fecha_desde) params.push(fecha_desde);
    if (fecha_hasta) params.push(fecha_hasta);
    
    const reporte = db.prepare(query).all(...params);
    
    res.json(reporte);
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/v1/reportes/productos
 * Reporte de productos más/menos vendidos
 */
router.get('/reportes/productos', authMiddleware, (req, res) => {
  try {
    const decoded = req.user;
    
    // Verificar permisos para ver reportes (admin, dueño o almacenero pueden ver productos)
    if (!['admin', 'dueño', 'almacenero'].includes(decoded.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para ver reportes de productos' });
    }
    
    const { tipo = 'mas_vendidos', limite = 10, fecha_desde, fecha_hasta } = req.query;
    
    let order = tipo === 'menos_vendidos' ? 'ASC' : 'DESC';
    
    let query = `
      SELECT 
        p.id,
        p.codigo,
        p.nombre,
        p.stock_actual,
        SUM(vd.cantidad) as cantidad_vendida,
        SUM(vd.subtotal) as total_vendido
      FROM productos p
      LEFT JOIN venta_detalle vd ON p.id = vd.producto_id
      LEFT JOIN ventas v ON vd.venta_id = v.id AND v.estado = 'completada'
      WHERE p.empresa_id = ?
      ${fecha_desde ? "AND DATE(v.fecha) >= ?" : ""}
      ${fecha_hasta ? "AND DATE(v.fecha) <= ?" : ""}
      GROUP BY p.id
      HAVING cantidad_vendida > 0
      ORDER BY cantidad_vendida ${order}
      LIMIT ?
    `;
    
    const params = [decoded.empresa_id];
    if (fecha_desde) params.push(fecha_desde);
    if (fecha_hasta) params.push(fecha_hasta);
    params.push(parseInt(limite));
    
    const reporte = db.prepare(query).all(...params);
    
    res.json(reporte);
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/v1/reportes/resumen
 * Resumen general del día
 */
router.get('/reportes/resumen', authMiddleware, (req, res) => {
  try {
    const decoded = req.user;
    
    // Verificar permisos para ver reportes financieros
    if (!canViewFinancialReports(decoded)) {
      return res.status(403).json({ error: 'No tiene permisos para ver reportes financieros' });
    }
    
    // Ventas del día
    const ventasDia = db.prepare(`
      SELECT 
        COUNT(*) as cantidad,
        COALESCE(SUM(total), 0) as total,
        COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) as efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) as transferencia
      FROM ventas
      WHERE empresa_id = ? AND DATE(fecha) = DATE('now') AND estado = 'completada'
    `).get(decoded.empresa_id);
    
    // Turnos activos
    const turnosActivos = db.prepare(`
      SELECT COUNT(*) as cantidad
      FROM turnos t
      JOIN puntos_venta pv ON t.punto_venta_id = pv.id
      WHERE pv.empresa_id = ? AND t.estado = 'abierto'
    `).get(decoded.empresa_id);
    
    // Alertas de stock
    const alertasStock = db.prepare(`
      SELECT COUNT(*) as cantidad
      FROM productos
      WHERE empresa_id = ? AND activo = 1 AND stock_actual <= stock_minimo
    `).get(decoded.empresa_id);
    
    // Productos totales
    const productosTotales = db.prepare(`
      SELECT COUNT(*) as cantidad
      FROM productos
      WHERE empresa_id = ? AND activo = 1
    `).get(decoded.empresa_id);
    
    res.json({
      fecha: new Date().toISOString().split('T')[0],
      ventas: ventasDia,
      turnos_activos: turnosActivos.cantidad,
      alertas_stock: alertasStock.cantidad,
      productos_totales: productosTotales.cantidad
    });
  } catch (error) {
    console.error('Error al obtener resumen:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
