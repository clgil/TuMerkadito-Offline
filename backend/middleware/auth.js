const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tu-merkadito-secret-key-cuba-2024';
const JWT_EXPIRES_IN = '8h';

/**
 * Hashear un PIN o contraseña
 */
async function hashPin(pin) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

/**
 * Verificar un PIN contra su hash
 */
async function verifyPin(pin, hash) {
  return bcrypt.compare(pin, hash);
}

/**
 * Generar token JWT
 */
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      rol: user.rol, 
      empresa_id: user.empresa_id,
      punto_venta_id: user.punto_venta_id
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verificar token JWT
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware para proteger rutas con JWT
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  
  req.user = decoded;
  next();
}

/**
 * Middleware para verificar roles
 */
function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    
    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tiene permisos suficientes' });
    }
    
    next();
  };
}

module.exports = {
  hashPin,
  verifyPin,
  generateToken,
  verifyToken,
  authMiddleware,
  roleMiddleware,
  JWT_SECRET
};
