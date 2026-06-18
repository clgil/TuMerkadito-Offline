const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'merkadito.db');

function initDatabase() {
  // Eliminar BD existente si existe
  const fs = require('fs');
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');

  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE empresas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        nrc TEXT,
        logo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        email TEXT,
        pin TEXT NOT NULL,
        rol TEXT NOT NULL,
        activo BOOLEAN DEFAULT 1,
        punto_venta_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE almacenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        direccion TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE puntos_venta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        codigo_corto TEXT,
        almacen_id INTEGER,
        tipo_registro TEXT DEFAULT 'almacen',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        codigo TEXT UNIQUE,
        nombre TEXT NOT NULL,
        unidad TEXT DEFAULT 'unidad',
        stock_actual REAL DEFAULT 0,
        stock_minimo REAL DEFAULT 5,
        costo REAL DEFAULT 0,
        precio REAL NOT NULL,
        proveedor TEXT,
        categoria_id INTEGER,
        activo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE turnos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        punto_venta_id INTEGER NOT NULL,
        vendedor_id INTEGER NOT NULL,
        fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_cierre DATETIME,
        monto_inicial REAL DEFAULT 0,
        monto_esperado REAL DEFAULT 0,
        monto_efectivo REAL DEFAULT 0,
        monto_transferencias REAL DEFAULT 0,
        ajuste REAL DEFAULT 0,
        nota_ajuste TEXT,
        estado TEXT DEFAULT 'abierto'
    );

    CREATE TABLE ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        turno_id INTEGER,
        vendedor_id INTEGER NOT NULL,
        punto_venta_id INTEGER,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        total REAL NOT NULL,
        metodo_pago TEXT NOT NULL,
        efectivo_recibido REAL DEFAULT 0,
        cambio REAL DEFAULT 0,
        estado TEXT DEFAULT 'completada',
        sync_status TEXT DEFAULT 'pending'
    );

    CREATE TABLE venta_detalle (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        precio_unitario REAL NOT NULL,
        descuento REAL DEFAULT 0,
        subtotal REAL NOT NULL
    );

    CREATE TABLE movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        almacen_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        cantidad REAL NOT NULL,
        costo_unitario REAL DEFAULT 0,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        motivo TEXT,
        usuario_id INTEGER,
        turno_id INTEGER,
        referencia_id INTEGER
    );

    CREATE TABLE configuracion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT UNIQUE NOT NULL,
        valor TEXT,
        empresa_id INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insertar datos iniciales
  db.exec("INSERT INTO empresas (nombre, nrc) VALUES ('Empresa Demo', '000000000')");
  db.exec("INSERT INTO almacenes (empresa_id, nombre) VALUES (1, 'Almacen Principal')");
  db.exec("INSERT INTO categorias (empresa_id, nombre) VALUES (1, 'General')");
  db.exec("INSERT INTO puntos_venta (empresa_id, nombre, codigo_corto, almacen_id, tipo_registro) VALUES (1, 'Punto de Venta 1', 'PV1', 1, 'almacen')");

  // Hash de PINs: admin=1234, vendedor=0000
  const pinAdmin = bcrypt.hashSync('1234', 10);
  const pinVendedor = bcrypt.hashSync('0000', 10);

  const stmt = db.prepare('INSERT INTO usuarios (empresa_id, nombre, email, pin, rol, punto_venta_id) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(1, 'Administrador', 'admin@merkadito.cu', pinAdmin, 'admin', null);
  stmt.run(1, 'Vendedor Demo', 'vendedor@merkadito.cu', pinVendedor, 'vendedor', 1);

  db.exec(`INSERT INTO productos (empresa_id, codigo, nombre, unidad, stock_actual, stock_minimo, costo, precio, categoria_id) VALUES
    (1, '001', 'Arroz 1lb', 'unidad', 100, 20, 0.50, 0.80, 1),
    (1, '002', 'Frijoles 1lb', 'unidad', 50, 10, 0.60, 0.90, 1),
    (1, '003', 'Aceite 500ml', 'unidad', 30, 5, 1.20, 1.80, 1),
    (1, '004', 'Cafe 250g', 'unidad', 40, 10, 2.00, 3.00, 1),
    (1, '005', 'Azucar 1lb', 'unidad', 80, 15, 0.40, 0.65, 1)`);

  db.exec(`INSERT INTO configuracion (clave, valor, empresa_id) VALUES
    ('sync_enabled', 'false', 1),
    ('sync_interval_hours', '6', 1),
    ('backup_enabled', 'true', 1)`);

  console.log('✅ Base de datos inicializada correctamente en:', DB_PATH);
  console.log('Usuarios creados:');
  console.log('  - admin@merkadito.cu / PIN: 1234');
  console.log('  - vendedor@merkadito.cu / PIN: 0000');

  db.close();
}

initDatabase();
