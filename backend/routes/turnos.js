const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * GET /api/v1/turnos/activo
 * Obtener turno activo de un vendedor
 */
router.get('/activo', (req, res) => {
  try {
    const { vendedor_id } = req.query;
    
    if (!vendedor_id) {
      return res.status(400).json({ error: 'vendedor_id es requerido' });
    }
    
    const turno = db.prepare(`
      SELECT t.*, pv.nombre as punto_venta_nombre, pv.almacen_id,
             u.nombre as vendedor_nombre
      FROM turnos t
      JOIN puntos_venta pv ON t.punto_venta_id = pv.id
      JOIN usuarios u ON t.vendedor_id = u.id
      WHERE t.vendedor_id = ? AND t.estado = 'abierto'
      ORDER BY t.fecha_apertura DESC
      LIMIT 1
    `).get(vendedor_id);
    
    if (!turno) {
      return res.json(null);
    }
    
    // Obtener total de ventas del turno
    const ventasTotal = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_ventas, COUNT(*) as cantidad_ventas
      FROM ventas
      WHERE turno_id = ? AND estado = 'completada'
    `).get(turno.id);
    
    turno.total_ventas = ventasTotal.total_ventas;
    turno.cantidad_ventas = ventasTotal.cantidad_ventas;
    
    res.json(turno);
  } catch (error) {
    console.error('Error al obtener turno activo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/turnos/abrir
 * Abrir nuevo turno
 */
router.post('/abrir', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { punto_venta_id, monto_inicial } = req.body;
    
    // Si no se proporciona punto_venta_id, usar el del usuario
    const pvId = punto_venta_id || decoded.punto_venta_id;
    
    if (!pvId) {
      return res.status(400).json({ error: 'Punto de venta es requerido' });
    }
    
    // Verificar que no tenga un turno abierto ya
    const turnoExistente = db.prepare(`
      SELECT id FROM turnos 
      WHERE vendedor_id = ? AND estado = 'abierto'
    `).get(decoded.id);
    
    if (turnoExistente) {
      return res.status(400).json({ error: 'Ya tiene un turno abierto' });
    }
    
    const result = db.prepare(`
      INSERT INTO turnos (punto_venta_id, vendedor_id, monto_inicial, estado)
      VALUES (?, ?, ?, 'abierto')
    `).run(pvId, decoded.id, monto_inicial || 0);
    
    // Obtener el turno creado con detalles
    const turno = db.prepare(`
      SELECT t.*, pv.nombre as punto_venta_nombre, pv.almacen_id,
             u.nombre as vendedor_nombre
      FROM turnos t
      JOIN puntos_venta pv ON t.punto_venta_id = pv.id
      JOIN usuarios u ON t.vendedor_id = u.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    
    res.json({
      success: true,
      message: 'Turno abierto exitosamente',
      turno
    });
  } catch (error) {
    console.error('Error al abrir turno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/turnos/cerrar
 * Cerrar turno con conteo final
 */
router.post('/cerrar', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { turno_id, monto_efectivo, monto_transferencias, nota_ajuste } = req.body;
    
    if (!turno_id) {
      return res.status(400).json({ error: 'turno_id es requerido' });
    }
    
    // Verificar que el turno existe y está abierto
    const turno = db.prepare(`
      SELECT * FROM turnos 
      WHERE id = ? AND estado = 'abierto'
    `).get(turno_id);
    
    if (!turno) {
      return res.status(404).json({ error: 'Turno no encontrado o ya cerrado' });
    }
    
    // Verificar permisos (solo el vendedor o admin/dueño pueden cerrar)
    if (turno.vendedor_id !== decoded.id && !['admin', 'dueño'].includes(decoded.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para cerrar este turno' });
    }
    
    // Calcular monto esperado (monto inicial + ventas en efectivo)
    const ventasEfectivo = db.prepare(`
      SELECT COALESCE(SUM(efectivo_recibido), 0) as total_efectivo
      FROM ventas
      WHERE turno_id = ? AND estado = 'completada' AND metodo_pago IN ('efectivo', 'mixto')
    `).get(turno_id);
    
    const ventasTransferencia = db.prepare(`
      SELECT COALESCE(SUM(monto_transferencias), 0) as total_transferencia
      FROM ventas
      WHERE turno_id = ? AND estado = 'completada' AND metodo_pago IN ('transferencia', 'mixto')
    `).get(turno_id);
    
    const monto_esperado_efectivo = turno.monto_inicial + ventasEfectivo.total_efectivo;
    const monto_esperado_transferencia = ventasTransferencia.total_transferencia || 0;
    const monto_esperado_total = monto_esperado_efectivo + monto_esperado_transferencia;
    
    const monto_real_total = (monto_efectivo || 0) + (monto_transferencias || 0);
    const ajuste = monto_real_total - monto_esperado_total;
    
    // Cerrar turno
    db.prepare(`
      UPDATE turnos 
      SET fecha_cierre = CURRENT_TIMESTAMP,
          monto_esperado = ?,
          monto_efectivo = ?,
          monto_transferencias = ?,
          ajuste = ?,
          nota_ajuste = ?,
          estado = 'cerrado'
      WHERE id = ?
    `).run(
      monto_esperado_total,
      monto_efectivo || 0,
      monto_transferencias || 0,
      ajuste,
      nota_ajuste || null,
      turno_id
    );
    
    // Obtener turno actualizado
    const turnoActualizado = db.prepare(`
      SELECT t.*, pv.nombre as punto_venta_nombre,
             u.nombre as vendedor_nombre
      FROM turnos t
      JOIN puntos_venta pv ON t.punto_venta_id = pv.id
      JOIN usuarios u ON t.vendedor_id = u.id
      WHERE t.id = ?
    `).get(turno_id);
    
    res.json({
      success: true,
      message: 'Turno cerrado exitosamente',
      turno: turnoActualizado,
      resumen: {
        monto_esperado: monto_esperado_total,
        monto_real: monto_real_total,
        diferencia: ajuste
      }
    });
  } catch (error) {
    console.error('Error al cerrar turno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/v1/turnos/historial
 * Listar turnos cerrados con filtros
 */
router.get('/historial', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { fecha_desde, fecha_hasta, vendedor_id, estado } = req.query;
    
    let query = `
      SELECT t.*, pv.nombre as punto_venta_nombre,
             u.nombre as vendedor_nombre
      FROM turnos t
      JOIN puntos_venta pv ON t.punto_venta_id = pv.id
      JOIN usuarios u ON t.vendedor_id = u.id
      WHERE t.punto_venta_id IN (
        SELECT id FROM puntos_venta WHERE empresa_id = ?
      )
    `;
    
    const params = [decoded.empresa_id];
    
    if (fecha_desde) {
      query += ' AND DATE(t.fecha_apertura) >= ?';
      params.push(fecha_desde);
    }
    
    if (fecha_hasta) {
      query += ' AND DATE(t.fecha_apertura) <= ?';
      params.push(fecha_hasta);
    }
    
    if (vendedor_id) {
      query += ' AND t.vendedor_id = ?';
      params.push(vendedor_id);
    }
    
    if (estado) {
      query += ' AND t.estado = ?';
      params.push(estado);
    }
    
    query += ' ORDER BY t.fecha_apertura DESC';
    
    const turnos = db.prepare(query).all(...params);
    
    res.json(turnos);
  } catch (error) {
    console.error('Error al listar turnos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
