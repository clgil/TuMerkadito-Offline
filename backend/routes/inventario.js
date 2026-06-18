const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * GET /api/v1/inventario/stock
 * Obtener stock actual por almacén
 */
router.get('/stock', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { almacen_id, categoria } = req.query;
    
    let query = `
      SELECT p.*, c.nombre as categoria_nombre, a.nombre as almacen_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN puntos_venta pv ON p.empresa_id = pv.empresa_id
      LEFT JOIN almacenes a ON pv.almacen_id = a.id
      WHERE p.empresa_id = ? AND p.activo = 1
    `;
    
    const params = [decoded.empresa_id];
    
    if (almacen_id) {
      query += ' AND pv.almacen_id = ?';
      params.push(almacen_id);
    }
    
    if (categoria) {
      query += ' AND p.categoria_id = ?';
      params.push(categoria);
    }
    
    // Alertas de stock
    query += `
      ORDER BY 
        CASE WHEN p.stock_actual <= p.stock_minimo THEN 0 ELSE 1 END,
        p.nombre
    `;
    
    const productos = db.prepare(query).all(...params);
    
    res.json(productos);
  } catch (error) {
    console.error('Error al obtener stock:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/v1/inventario/alertas
 * Obtener alertas de stock crítico
 */
router.get('/alertas', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const alertas = db.prepare(`
      SELECT p.*, 
             CASE 
               WHEN p.stock_actual = 0 THEN 'Sin stock'
               WHEN p.stock_actual <= p.stock_minimo THEN 'Stock crítico'
               ELSE 'Normal'
             END as tipo_alerta
      FROM productos p
      WHERE p.empresa_id = ? AND p.activo = 1 AND p.stock_actual <= p.stock_minimo
      ORDER BY p.stock_actual ASC
    `).all(decoded.empresa_id);
    
    res.json(alertas);
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/movimientos/entrada
 * Registrar entrada de inventario (compra)
 */
router.post('/entrada', (req, res) => {
  const transaction = db.transaction(() => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado' });
      }
      
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const { producto_id, almacen_id, cantidad, costo_unitario, motivo, proveedor } = req.body;
      
      if (!producto_id || !cantidad || cantidad <= 0) {
        return res.status(400).json({ error: 'Producto y cantidad son requeridos' });
      }
      
      // Actualizar stock y costo promedio
      const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(producto_id);
      
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      const nuevoStock = producto.stock_actual + cantidad;
      
      // Calcular nuevo costo promedio
      const costoActualTotal = producto.stock_actual * producto.costo;
      const costoNuevoTotal = cantidad * (costo_unitario || producto.costo);
      const nuevoCostoPromedio = (costoActualTotal + costoNuevoTotal) / nuevoStock;
      
      db.prepare(`
        UPDATE productos 
        SET stock_actual = ?, costo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nuevoStock, nuevoCostoPromedio, producto_id);
      
      // Registrar movimiento
      db.prepare(`
        INSERT INTO movimientos (producto_id, almacen_id, tipo, cantidad, costo_unitario, motivo, usuario_id)
        VALUES (?, ?, 'entrada', ?, ?, ?, ?)
      `).run(
        producto_id,
        almacen_id || 1,
        cantidad,
        costo_unitario || producto.costo,
        motivo || 'Entrada por compra' + (proveedor ? ' - Proveedor: ' + proveedor : ''),
        decoded.id
      );
      
      res.json({
        success: true,
        message: 'Entrada registrada exitosamente',
        nuevo_stock: nuevoStock,
        nuevo_costo: nuevoCostoPromedio
      });
    } catch (error) {
      console.error('Error al registrar entrada:', error);
      throw error;
    }
  });
  
  try {
    transaction();
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/movimientos/salida
 * Registrar salida de inventario (merma, daño, ajuste)
 */
router.post('/salida', (req, res) => {
  const transaction = db.transaction(() => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado' });
      }
      
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const { producto_id, almacen_id, cantidad, motivo } = req.body;
      
      if (!producto_id || !cantidad || cantidad <= 0) {
        return res.status(400).json({ error: 'Producto y cantidad son requeridos' });
      }
      
      const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(producto_id);
      
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      if (producto.stock_actual < cantidad) {
        return res.status(400).json({ error: 'Stock insuficiente' });
      }
      
      const nuevoStock = producto.stock_actual - cantidad;
      
      db.prepare(`
        UPDATE productos 
        SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nuevoStock, producto_id);
      
      // Registrar movimiento
      db.prepare(`
        INSERT INTO movimientos (producto_id, almacen_id, tipo, cantidad, costo_unitario, motivo, usuario_id)
        VALUES (?, ?, 'salida', ?, ?, ?, ?)
      `).run(
        producto_id,
        almacen_id || 1,
        cantidad,
        producto.costo,
        motivo || 'Salida sin venta',
        decoded.id
      );
      
      res.json({
        success: true,
        message: 'Salida registrada exitosamente',
        nuevo_stock: nuevoStock
      });
    } catch (error) {
      console.error('Error al registrar salida:', error);
      throw error;
    }
  });
  
  try {
    transaction();
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/movimientos/ajuste
 * Ajuste de inventario por conteo físico
 */
router.post('/ajuste', (req, res) => {
  const transaction = db.transaction(() => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado' });
      }
      
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const { producto_id, almacen_id, stock_real, motivo } = req.body;
      
      if (!producto_id || stock_real === undefined) {
        return res.status(400).json({ error: 'Producto y stock real son requeridos' });
      }
      
      const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(producto_id);
      
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      const diferencia = stock_real - producto.stock_actual;
      
      if (diferencia === 0) {
        return res.json({
          success: true,
          message: 'No se requiere ajuste, el stock coincide',
          stock_actual: producto.stock_actual
        });
      }
      
      // Actualizar stock
      db.prepare(`
        UPDATE productos 
        SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(stock_real, producto_id);
      
      // Registrar movimiento de ajuste
      db.prepare(`
        INSERT INTO movimientos (producto_id, almacen_id, tipo, cantidad, costo_unitario, motivo, usuario_id)
        VALUES (?, ?, 'ajuste', ?, ?, ?, ?)
      `).run(
        producto_id,
        almacen_id || 1,
        Math.abs(diferencia),
        producto.costo,
        motivo || 'Ajuste por inventario físico',
        decoded.id
      );
      
      res.json({
        success: true,
        message: 'Ajuste registrado exitosamente',
        stock_anterior: producto.stock_actual,
        stock_nuevo: stock_real,
        diferencia: diferencia
      });
    } catch (error) {
      console.error('Error al ajustar inventario:', error);
      throw error;
    }
  });
  
  try {
    transaction();
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/v1/movimientos/historial
 * Listar movimientos de inventario
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
    
    const { fecha_desde, fecha_hasta, producto_id, tipo, limite = 100 } = req.query;
    
    let query = `
      SELECT m.*, p.nombre as producto_nombre, u.nombre as usuario_nombre, a.nombre as almacen_nombre
      FROM movimientos m
      JOIN productos p ON m.producto_id = p.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN almacenes a ON m.almacen_id = a.id
      WHERE p.empresa_id = ?
    `;
    
    const params = [decoded.empresa_id];
    
    if (fecha_desde) {
      query += ' AND DATE(m.fecha) >= ?';
      params.push(fecha_desde);
    }
    
    if (fecha_hasta) {
      query += ' AND DATE(m.fecha) <= ?';
      params.push(fecha_hasta);
    }
    
    if (producto_id) {
      query += ' AND m.producto_id = ?';
      params.push(producto_id);
    }
    
    if (tipo) {
      query += ' AND m.tipo = ?';
      params.push(tipo);
    }
    
    query += ' ORDER BY m.fecha DESC LIMIT ?';
    params.push(parseInt(limite));
    
    const movimientos = db.prepare(query).all(...params);
    
    res.json(movimientos);
  } catch (error) {
    console.error('Error al listar movimientos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
