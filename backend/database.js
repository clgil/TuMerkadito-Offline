const Database = require('better-sqlite3');
const { DB_PATH } = require('./scripts/init-db');

// Inicializar conexión a la base de datos
const db = new Database(DB_PATH);

// Configurar pragmas para mejor rendimiento y recuperación
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('cache_size = -2000'); // 2MB cache
db.pragma('temp_store = MEMORY');

// Manejar cierre graceful para asegurar que los datos se guarden
process.on('SIGINT', () => {
  console.log('\nCerrando conexión a la base de datos...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nCerrando conexión a la base de datos...');
  db.close();
  process.exit(0);
});

module.exports = db;
