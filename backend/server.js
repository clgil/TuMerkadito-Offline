const express = require('express');
const path = require('path');

// Inicializar base de datos
const { initDatabase } = require('./scripts/init-db');

// Intentar inicializar la BD, si ya existe no hace nada
try {
  initDatabase();
} catch (error) {
  console.log('Base de datos ya inicializada o error:', error.message);
}

const expressApp = require('express');
const cors = require('cors');
const db = require('./database');

// Importar rutas
const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const turnosRoutes = require('./routes/turnos');
const ventasRoutes = require('./routes/ventas');
const inventarioRoutes = require('./routes/inventario');
const syncRoutes = require('./routes/sync');

const app = expressApp();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend estático
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/productos', productosRoutes);
app.use('/api/v1/turnos', turnosRoutes);
app.use('/api/v1/ventas', ventasRoutes);
app.use('/api/v1/inventario', inventarioRoutes);
app.use('/api/v1', syncRoutes); // Incluye rutas /reportes/*

// Health check
app.get('/api/v1/health', (req, res) => {
  try {
    // Verificar que la BD esté accesible
    db.prepare('SELECT 1').get();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Ruta por defecto - servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         🛒 TU MERKADITO - Sistema Offline-First          ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║   Servidor corriendo en http://localhost:${PORT}              ║`);
  console.log('║                                                           ║');
  console.log('║   Usuarios demo:                                          ║');
  console.log('║   - Admin: admin@merkadito.cu / PIN: 1234                 ║');
  console.log('║   - Vendedor: vendedor@merkadito.cu / PIN: 0000           ║');
  console.log('║                                                           ║');
  console.log('║   Diseñado para Cuba - Funciona sin internet              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nRecibida señal SIGTERM, cerrando servidor...');
  server.close(() => {
    db.close();
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nRecibida señal SIGINT, cerrando servidor...');
  server.close(() => {
    db.close();
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;
