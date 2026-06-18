const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * GET /api/v1/productos
 * Listar productos con búsqueda y filtro por categoría
 */
router.get('/', (req, res) => {
  try {
    const { search, categoria, empresa_id } = req.query;
    
    // Si no se proporciona empresa_id, usar la del usuario autenticado
    const authHeader = req.headers.authorization;
    let userEmpresaId = empresa_id;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmpresaId = decoded.empresa_id;
      } catch (e) {
        // Ignorar error de token, intentar sin empresa
      }
    }
    
    let query = `
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1
    `;
    
    const params = [];
    
    if (userEmpresaId) {
      query += ' AND p.empresa_id = ?';
      params.push(userEmpresaId);
    }
    
    if (search) {
      query += ' AND (p.nombre LIKE ? OR p.codigo LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (categoria) {
      query += ' AND p.categoria_id = ?';
      params.push(categoria);
    }
    
    query += ' ORDER BY p.nombre';
    
    const productos = db.prepare(query).all(...params);
    
    res.json(productos);
  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/v1/productos/:id
 * Obtener producto por ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const producto = db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ?
    `).get(id);
    
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(producto);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/productos
 * Crear nuevo producto
 */
router.post('/', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { codigo, nombre, unidad, stock_actual, stock_minimo, costo, precio, proveedor, categoria_id } = req.body;
    
    if (!nombre || !precio) {
      return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }
    
    const result = db.prepare(`
      INSERT INTO productos (empresa_id, codigo, nombre, unidad, stock_actual, stock_minimo, costo, precio, proveedor, categoria_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decoded.empresa_id,
      codigo || null,
      nombre,
      unidad || 'unidad',
      stock_actual || 0,
      stock_minimo || 5,
      costo || 0,
      precio,
      proveedor || null,
      categoria_id || null
    );
    
    res.json({
      success: true,
      message: 'Producto creado exitosamente',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'El código ya está registrado' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/v1/productos/:id
 * Actualizar producto
 */
router.put('/:id', (req, res) => {
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
    const { codigo, nombre, unidad, stock_actual, stock_minimo, costo, precio, proveedor, categoria_id, activo } = req.body;
    
    const updates = [];
    const values = [];
    
    if (codigo !== undefined) {
      updates.push('codigo = ?');
      values.push(codigo);
    }
    if (nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (unidad !== undefined) {
      updates.push('unidad = ?');
      values.push(unidad);
    }
    if (stock_actual !== undefined) {
      updates.push('stock_actual = ?');
      values.push(stock_actual);
    }
    if (stock_minimo !== undefined) {
      updates.push('stock_minimo = ?');
      values.push(stock_minimo);
    }
    if (costo !== undefined) {
      updates.push('costo = ?');
      values.push(costo);
    }
    if (precio !== undefined) {
      updates.push('precio = ?');
      values.push(precio);
    }
    if (proveedor !== undefined) {
      updates.push('proveedor = ?');
      values.push(proveedor);
    }
    if (categoria_id !== undefined) {
      updates.push('categoria_id = ?');
      values.push(categoria_id);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      values.push(activo ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }
    
    values.push(id);
    values.push(decoded.empresa_id);
    
    db.prepare(`
      UPDATE productos 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND empresa_id = ?
    `).run(...values);
    
    res.json({ success: true, message: 'Producto actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/v1/productos/:id
 * Eliminar producto (soft delete)
 */
router.delete('/:id', (req, res) => {
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
    
    db.prepare(`
      UPDATE productos 
      SET activo = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND empresa_id = ?
    `).run(id, decoded.empresa_id);
    
    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
