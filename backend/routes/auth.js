const express = require('express');
const router = express.Router();
const db = require('../database');
const { hashPin, verifyPin, generateToken } = require('../middleware/auth');

/**
 * POST /api/v1/auth/login
 * Autenticar usuario con email y PIN
 */
router.post('/login', async (req, res) => {
  try {
    const { email, pin } = req.body;
    
    if (!email || !pin) {
      return res.status(400).json({ error: 'Email y PIN son requeridos' });
    }
    
    // Buscar usuario por email
    const user = db.prepare(`
      SELECT u.*, pv.almacen_id as pv_almacen_id
      FROM usuarios u
      LEFT JOIN puntos_venta pv ON u.punto_venta_id = pv.id
      WHERE u.email = ? AND u.activo = 1
    `).get(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }
    
    // Verificar PIN
    const validPin = await verifyPin(pin, user.pin);
    
    if (!validPin) {
      return res.status(401).json({ error: 'PIN incorrecto' });
    }
    
    // Generar token
    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        empresa_id: user.empresa_id,
        punto_venta_id: user.punto_venta_id
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/auth/verify
 * Verificar token JWT
 */
router.post('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Token no proporcionado' });
  }
  
  const token = authHeader.split(' ')[1];
  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
  }
});

/**
 * GET /api/v1/auth/users
 * Listar usuarios de la empresa (solo admin/dueño)
 */
router.get('/users', (req, res) => {
  try {
    const { authMiddleware, roleMiddleware } = require('../middleware/auth');
    
    // Verificar autenticación manualmente ya que no podemos usar middleware directamente
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!['admin', 'dueño'].includes(decoded.rol)) {
      return res.status(403).json({ error: 'No tiene permisos suficientes' });
    }
    
    const users = db.prepare(`
      SELECT u.id, u.nombre, u.email, u.rol, u.activo, u.punto_venta_id, 
             u.created_at, pv.nombre as punto_venta_nombre
      FROM usuarios u
      LEFT JOIN puntos_venta pv ON u.punto_venta_id = pv.id
      WHERE u.empresa_id = ?
      ORDER BY u.nombre
    `).all(decoded.empresa_id);
    
    res.json(users);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/v1/auth/users
 * Crear nuevo usuario (solo admin/dueño)
 */
router.post('/users', async (req, res) => {
  try {
    const { authMiddleware, roleMiddleware } = require('../middleware/auth');
    
    // Verificar autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!['admin', 'dueño'].includes(decoded.rol)) {
      return res.status(403).json({ error: 'No tiene permisos suficientes' });
    }
    
    const { nombre, email, pin, rol, punto_venta_id } = req.body;
    
    if (!nombre || !email || !pin || !rol) {
      return res.status(400).json({ error: 'Nombre, email, PIN y rol son requeridos' });
    }
    
    // Validar rol
    const rolesValidos = ['dueño', 'admin', 'vendedor', 'almacenero', 'economico'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    
    // Hashear PIN
    const hashedPin = await hashPin(pin);
    
    // Insertar usuario
    const result = db.prepare(`
      INSERT INTO usuarios (empresa_id, nombre, email, pin, rol, punto_venta_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(decoded.empresa_id, nombre, email, hashedPin, rol, punto_venta_id || null);
    
    res.json({
      success: true,
      message: 'Usuario creado exitosamente',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/v1/auth/users/:id
 * Actualizar usuario
 */
router.put('/users/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!['admin', 'dueño'].includes(decoded.rol)) {
      return res.status(403).json({ error: 'No tiene permisos suficientes' });
    }
    
    const { id } = req.params;
    const { nombre, email, pin, rol, activo, punto_venta_id } = req.body;
    
    // Construir update dinámico
    const updates = [];
    const values = [];
    
    if (nombre) {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (pin) {
      const hashedPin = await hashPin(pin);
      updates.push('pin = ?');
      values.push(hashedPin);
    }
    if (rol) {
      updates.push('rol = ?');
      values.push(rol);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      values.push(activo ? 1 : 0);
    }
    if (punto_venta_id !== undefined) {
      updates.push('punto_venta_id = ?');
      values.push(punto_venta_id);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }
    
    values.push(id);
    values.push(decoded.empresa_id);
    
    db.prepare(`
      UPDATE usuarios 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND empresa_id = ?
    `).run(...values);
    
    res.json({ success: true, message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
