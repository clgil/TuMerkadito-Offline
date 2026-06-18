const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * POST /api/v1/ventas
 * Registrar nueva venta
 */
router.post('/', (req, res) => {
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
      
      const { 
        turno_id, 
        punto_venta_id, 
        metodo_pago, 
        efectivo_recibido, 
        detalle,
        total 
      } = req.body;
      
      if (!detalle || !Array.isArray(detalle) || detalle.length === 0) {
        return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
      }
      
      if (!metodo_pago || !['efectivo', 'transferencia', 'mixto'].includes(metodo_pago)) {
        return res.status(400).json({ error: 'Método de pago inválido' });
      }
      
      // Calcular cambio si es efectivo o mixto
      let cambio = 0;
      if (metodo_pago === 'efectivo' || metodo_pago === 'mixto') {
        cambio = (efectivo_recibido || 0) - total;
        if (cambio < 0) {
          return res.status(400).json({ error: 'El efectivo recibido es menor que el total' });
        }
      }
      
      // Insertar venta
      const result = db.prepare(`
        INSERT INTO ventas (empresa_id, turno_id, vendedor_id, punto_venta_id, total, metodo_pago, efectivo_recibido, cambio, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completada')
      `).run(
        decoded.empresa_id,
        turno_id || null,
        decoded.id,
        punto_venta_id || decoded.punto_venta_id,
        total,
        metodo_pago,
        efectivo_recibido || 0,
        cambio
      );
      
      const ventaId = result.lastInsertRowid;
      
      // Procesar detalle y actualizar inventario
      for (const item of detalle) {
        const { producto_id, cantidad, precio_unitario, descuento = 0 } = item;
        
        const subtotal = (cantidad * precio_unitario) - descuento;
        
        // Insertar detalle de venta
        db.prepare(`
          INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(ventaId, producto_id, cantidad, precio_unitario, descuento, subtotal);
        
        // Actualizar stock del producto
        db.prepare(`
          UPDATE productos 
          SET stock_actual = stock_actual - ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(cantidad, producto_id);
        
        // Registrar movimiento de inventario
        db.prepare(`
          INSERT INTO movimientos (producto_id, almacen_id, tipo, cantidad, costo_unitario, motivo, usuario_id, turno_id, referencia_id)
          SELECT ?, pv.almacen_id, 'venta', ?, p.costo, 'Venta #' || ?, ?, ?
          FROM puntos_venta pv
          WHERE pv.id = ?
        `).run(
          producto_id,
          cantidad,
          ventaId,
          decoded.id,
          turno_id,
          punto_venta_id || decoded.punto_venta_id
        );
      }
      
      // Obtener venta completa con detalles
      const venta = db.prepare(`
        SELECT v.*, u.nombre as vendedor_nombre, pv.nombre as punto_venta_nombre
        FROM ventas v
        LEFT JOIN usuarios u ON v.vendedor_id = u.id
        LEFT JOIN puntos_venta pv ON v.punto_venta_id = pv.id
        WHERE v.id = ?
      `).get(ventaId);
      
      const detalles = db.prepare(`
        SELECT vd.*, p.nombre as producto_nombre, p.codigo as producto_codigo
        FROM venta_detalle vd
        JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ?
      `).all(ventaId);
      
      venta.detalles = detalles;
      
      return res.json({
        success: true,
        message: 'Venta registrada exitosamente',
        venta
      });
    } catch (error) {
      console.error('Error al registrar venta:', error);
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
 * GET /api/v1/ventas
 * Listar ventas con filtros
 */
router.get('/', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { fecha_desde, fecha_hasta, vendedor_id, turno_id, limite = 50 } = req.query;
    
    let query = `
      SELECT v.*, u.nombre as vendedor_nombre, pv.nombre as punto_venta_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      LEFT JOIN puntos_venta pv ON v.punto_venta_id = pv.id
      WHERE v.empresa_id = ?
    `;
    
    const params = [decoded.empresa_id];
    
    if (fecha_desde) {
      query += ' AND DATE(v.fecha) >= ?';
      params.push(fecha_desde);
    }
    
    if (fecha_hasta) {
      query += ' AND DATE(v.fecha) <= ?';
      params.push(fecha_hasta);
    }
    
    if (vendedor_id) {
      query += ' AND v.vendedor_id = ?';
      params.push(vendedor_id);
    }
    
    if (turno_id) {
      query += ' AND v.turno_id = ?';
      params.push(turno_id);
    }
    
    query += ' ORDER BY v.fecha DESC LIMIT ?';
    params.push(parseInt(limite));
    
    const ventas = db.prepare(query).all(...params);
    
    res.json(ventas);
  } catch (error) {
    console.error('Error al listar ventas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/v1/ventas/:id
 * Obtener venta por ID con detalles
 */
router.get('/:id', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { id } = req.params;
    
    const venta = db.prepare(`
      SELECT v.*, u.nombre as vendedor_nombre, pv.nombre as punto_venta_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      LEFT JOIN puntos_venta pv ON v.punto_venta_id = pv.id
      WHERE v.id = ? AND v.empresa_id = ?
    `).get(id, decoded.empresa_id);
    
    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const detalles = db.prepare(`
      SELECT vd.*, p.nombre as producto_nombre, p.codigo as producto_codigo
      FROM venta_detalle vd
      JOIN productos p ON vd.producto_id = p.id
      WHERE vd.venta_id = ?
    `).all(id);
    
    venta.detalles = detalles;
    
    res.json(venta);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/ventas/:id/cancelar
 * Cancelar venta (revertir inventario)
 */
router.post('/:id/cancelar', (req, res) => {
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
      
      // Solo admin o dueño pueden cancelar ventas
      if (!['admin', 'dueño'].includes(decoded.rol)) {
        return res.status(403).json({ error: 'No tiene permisos para cancelar ventas' });
      }
      
      const { id } = req.params;
      const { motivo } = req.body;
      
      const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
      
      if (!venta) {
        return res.status(404).json({ error: 'Venta no encontrada' });
      }
      
      if (venta.estado === 'cancelada') {
        return res.status(400).json({ error: 'La venta ya está cancelada' });
      }
      
      // Revertir stock
      const detalles = db.prepare('SELECT * FROM venta_detalle WHERE venta_id = ?').all(id);
      
      for (const detalle of detalles) {
        db.prepare(`
          UPDATE productos 
          SET stock_actual = stock_actual + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(detalle.cantidad, detalle.producto_id);
        
        // Registrar movimiento de ajuste
        db.prepare(`
          INSERT INTO movimientos (producto_id, almacen_id, tipo, cantidad, costo_unitario, motivo, usuario_id, referencia_id)
          SELECT ?, pv.almacen_id, 'ajuste', ?, p.costo, 'Cancelación venta #' || ${id} + COALESCE(?, ''), ?
          FROM puntos_venta pv
          WHERE pv.id = ?
        `).run(
          detalle.producto_id,
          detalle.cantidad,
          motivo || 'Cancelación de venta',
          decoded.id,
          venta.punto_venta_id
        );
      }
      
      // Actualizar estado de venta
      db.prepare(`
        UPDATE ventas 
        SET estado = 'cancelada', sync_status = 'pending'
        WHERE id = ?
      `).run(id);
      
      res.json({
        success: true,
        message: 'Venta cancelada exitosamente'
      });
    } catch (error) {
      console.error('Error al cancelar venta:', error);
      throw error;
    }
  });
  
  try {
    transaction();
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
