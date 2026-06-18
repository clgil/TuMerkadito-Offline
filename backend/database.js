const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Definir DB_PATH directamente aquí para evitar dependencia circular
const DB_PATH = path.join(__dirname, 'data', 'merkadito.db');

// Asegurar que el directorio data/ existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  console.log('Creando directorio de base de datos:', dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
}

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
