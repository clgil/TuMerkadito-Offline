const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tu-merkadito-secret-key-cuba-2024';
const JWT_EXPIRES_IN = '8h';

/**
 * Definición de roles y sus permisos
 */
const ROLES = {
  DUEÑO: 'dueño',
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
  ALMACENERO: 'almacenero',
  ECONOMICO: 'economico'
};

/**
 * Permisos por rol según el manual de usuario
 */
const PERMISOS = {
  [ROLES.DUEÑO]: {
    descripcion: 'Acceso total al sistema',
    puedeCrearEmpresas: true,
    puedeGestionarTrabajadores: true,
    puedeVerTodo: true,
    puedeGestionarAdministradores: true,
    puedeCrearProductos: true,
    puedeVerVentas: true,
    puedeCerrarTurnosAjenos: true,
    puedeExportarRespaldos: true,
    puedeAccederPOS: true,
    puedeAbrirCerrarTurnoPropio: true,
    puedeRegistrarVentas: true,
    puedeConsultarProductos: true,
    puedeGestionarInventario: true,
    puedeVerReportesFinancieros: true,
    puedeModificarDatos: true
  },
  [ROLES.ADMIN]: {
    descripcion: 'Gestión operativa',
    puedeCrearEmpresas: false,
    puedeGestionarTrabajadores: true,
    puedeVerTodo: true,
    puedeGestionarAdministradores: false,
    puedeCrearProductos: true,
    puedeVerVentas: true,
    puedeCerrarTurnosAjenos: true,
    puedeExportarRespaldos: true,
    puedeAccederPOS: true,
    puedeAbrirCerrarTurnoPropio: true,
    puedeRegistrarVentas: true,
    puedeConsultarProductos: true,
    puedeGestionarInventario: true,
    puedeVerReportesFinancieros: true,
    puedeModificarDatos: true
  },
  [ROLES.VENDEDOR]: {
    descripcion: 'Solo acceso a POS',
    puedeCrearEmpresas: false,
    puedeGestionarTrabajadores: false,
    puedeVerTodo: false,
    puedeGestionarAdministradores: false,
    puedeCrearProductos: false,
    puedeVerVentas: false, // Solo las propias
    puedeCerrarTurnosAjenos: false,
    puedeExportarRespaldos: false,
    puedeAccederPOS: true,
    puedeAbrirCerrarTurnoPropio: true,
    puedeRegistrarVentas: true,
    puedeConsultarProductos: true,
    puedeGestionarInventario: false,
    puedeVerReportesFinancieros: false,
    puedeModificarDatos: false
  },
  [ROLES.ALMAZENERO]: {
    descripcion: 'Gestionar inventario',
    puedeCrearEmpresas: false,
    puedeGestionarTrabajadores: false,
    puedeVerTodo: false,
    puedeGestionarAdministradores: false,
    puedeCrearProductos: false,
    puedeVerVentas: false,
    puedeCerrarTurnosAjenos: false,
    puedeExportarRespaldos: false,
    puedeAccederPOS: false,
    puedeAbrirCerrarTurnoPropio: false,
    puedeRegistrarVentas: false,
    puedeConsultarProductos: true,
    puedeGestionarInventario: true,
    puedeVerAlertasStock: true,
    puedeVerReportesFinancieros: false,
    puedeModificarDatos: false
  },
  [ROLES.ECONOMICO]: {
    descripcion: 'Solo ver reportes financieros',
    puedeCrearEmpresas: false,
    puedeGestionarTrabajadores: false,
    puedeVerTodo: false,
    puedeGestionarAdministradores: false,
    puedeCrearProductos: false,
    puedeVerVentas: false,
    puedeCerrarTurnosAjenos: false,
    puedeExportarRespaldos: false,
    puedeAccederPOS: false,
    puedeAbrirCerrarTurnoPropio: false,
    puedeRegistrarVentas: false,
    puedeConsultarProductos: false,
    puedeGestionarInventario: false,
    puedeVerReportesFinancieros: true,
    puedeModificarDatos: false
  }
};

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
      punto_venta_id: user.punto_venta_id,
      permisos: PERMISOS[user.rol] || {}
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

/**
 * Middleware para verificar permisos específicos
 */
function permisoMiddleware(permisoRequerido) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    
    const permisos = req.user.permisos || PERMISOS[req.user.rol] || {};
    
    if (!permisos[permisoRequerido]) {
      return res.status(403).json({ 
        error: 'No tiene permisos suficientes',
        rol: req.user.rol,
        permiso_requerido: permisoRequerido
      });
    }
    
    next();
  };
}

/**
 * Verificar si un usuario puede gestionar otro usuario
 * Un usuario solo puede gestionar usuarios de su misma empresa
 */
function canManageUser(manager, targetUser) {
  if (!manager || !targetUser) return false;
  
  // Dueño puede gestionar todos los usuarios de su empresa
  if (manager.rol === ROLES.DUEÑO && manager.empresa_id === targetUser.empresa_id) {
    return true;
  }
  
  // Admin puede gestionar vendedores, almaceneros y economicos de su empresa
  if (manager.rol === ROLES.ADMIN && manager.empresa_id === targetUser.empresa_id) {
    const rolesGestionables = [ROLES.VENDEDOR, ROLES.ALMAZENERO, ROLES.ECONOMICO];
    return rolesGestionables.includes(targetUser.rol);
  }
  
  return false;
}

/**
 * Verificar si un usuario puede cerrar turnos de otros
 */
function canCloseOthersTurns(user) {
  return user.rol === ROLES.DUEÑO || user.rol === ROLES.ADMIN;
}

/**
 * Verificar si un usuario puede ver todas las ventas
 */
function canViewAllSales(user) {
  return user.rol === ROLES.DUEÑO || user.rol === ROLES.ADMIN;
}

/**
 * Verificar si un usuario puede gestionar inventario
 */
function canManageInventory(user) {
  return user.rol === ROLES.DUEÑO || user.rol === ROLES.ADMIN || user.rol === ROLES.ALMAZENERO;
}

/**
 * Verificar si un usuario puede ver reportes financieros
 */
function canViewFinancialReports(user) {
  return user.rol === ROLES.DUEÑO || user.rol === ROLES.ADMIN || user.rol === ROLES.ECONOMICO;
}

module.exports = {
  hashPin,
  verifyPin,
  generateToken,
  verifyToken,
  authMiddleware,
  roleMiddleware,
  permisoMiddleware,
  canManageUser,
  canCloseOthersTurns,
  canViewAllSales,
  canManageInventory,
  canViewFinancialReports,
  ROLES,
  PERMISOS,
  JWT_SECRET
};
