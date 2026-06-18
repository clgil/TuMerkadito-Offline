const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'merkadito.db');

function initDatabase() {
  const db = new Database(DB_PATH);
  
  // Habilitar WAL para mejor recuperación ante apagones
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  db.exec(`
    -- Empresa
    CREATE TABLE IF NOT EXISTS empresas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        nrc TEXT,
        logo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Usuario (trabajador)
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        email TEXT,
        pin TEXT NOT NULL,
        rol TEXT NOT NULL CHECK(rol IN ('dueño','admin','vendedor','almacenero','economico')),
        activo BOOLEAN DEFAULT 1,
        punto_venta_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(empresa_id) REFERENCES empresas(id),
        FOREIGN KEY(punto_venta_id) REFERENCES puntos_venta(id)
    );

    -- Almacenes
    CREATE TABLE IF NOT EXISTS almacenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        direccion TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(empresa_id) REFERENCES empresas(id)
    );

    -- Categorías de productos
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(empresa_id) REFERENCES empresas(id)
    );

    -- Punto de venta
    CREATE TABLE IF NOT EXISTS puntos_venta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        codigo_corto TEXT,
        almacen_id INTEGER,
        tipo_registro TEXT DEFAULT 'almacen' CHECK(tipo_registro IN ('almacen','ipv','sin_accion')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(empresa_id) REFERENCES empresas(id),
        FOREIGN KEY(almacen_id) REFERENCES almacenes(id)
    );

    -- Productos
    CREATE TABLE IF NOT EXISTS productos (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(empresa_id) REFERENCES empresas(id),
        FOREIGN KEY(categoria_id) REFERENCES categorias(id)
    );

    -- Turnos (IPV)
    CREATE TABLE IF NOT EXISTS turnos (
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
        estado TEXT DEFAULT 'abierto' CHECK(estado IN ('abierto','cerrado')),
        FOREIGN KEY(punto_venta_id) REFERENCES puntos_venta(id),
        FOREIGN KEY(vendedor_id) REFERENCES usuarios(id)
    );

    -- Ventas (cabecera)
    CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        turno_id INTEGER,
        vendedor_id INTEGER NOT NULL,
        punto_venta_id INTEGER,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        total REAL NOT NULL,
        metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('efectivo','transferencia','mixto')),
        efectivo_recibido REAL DEFAULT 0,
        cambio REAL DEFAULT 0,
        estado TEXT DEFAULT 'completada' CHECK(estado IN ('completada','cancelada','pendiente_sync')),
        sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending','synced','failed')),
        synced_at DATETIME,
        FOREIGN KEY(empresa_id) REFERENCES empresas(id),
        FOREIGN KEY(turno_id) REFERENCES turnos(id),
        FOREIGN KEY(vendedor_id) REFERENCES usuarios(id),
        FOREIGN KEY(punto_venta_id) REFERENCES puntos_venta(id)
    );

    -- Detalle de venta
    CREATE TABLE IF NOT EXISTS venta_detalle (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        precio_unitario REAL NOT NULL,
        descuento REAL DEFAULT 0,
        subtotal REAL NOT NULL,
        FOREIGN KEY(venta_id) REFERENCES ventas(id),
        FOREIGN KEY(producto_id) REFERENCES productos(id)
    );

    -- Movimientos de inventario
    CREATE TABLE IF NOT EXISTS movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        almacen_id INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida','transferencia','ajuste','venta')),
        cantidad REAL NOT NULL,
        costo_unitario REAL DEFAULT 0,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        motivo TEXT,
        usuario_id INTEGER,
        turno_id INTEGER,
        referencia_id INTEGER,
        FOREIGN KEY(producto_id) REFERENCES productos(id),
        FOREIGN KEY(almacen_id) REFERENCES almacenes(id),
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY(turno_id) REFERENCES turnos(id)
    );

    -- Cola de sincronización (para cloud opcional)
    CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('create','update','delete')),
        data TEXT,
        attempts INTEGER DEFAULT 0,
        last_attempt DATETIME,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','success','failed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Configuración del sistema
    CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT UNIQUE NOT NULL,
        valor TEXT,
        empresa_id INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(empresa_id) REFERENCES empresas(id)
    );

    -- Índices para mejor rendimiento
    CREATE INDEX IF NOT EXISTS idx_productos_empresa ON productos(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);
    CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
    CREATE INDEX IF NOT EXISTS idx_ventas_turno ON ventas(turno_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos(producto_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
    CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos(estado);
    CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);
  `);

  // Insertar empresa por defecto si no existe
  const stmt = db.prepare('SELECT COUNT(*) as count FROM empresas');
  const result = stmt.get();
  
  if (result.count === 0) {
    db.exec(`
      INSERT INTO empresas (nombre, nrc) VALUES ('Empresa Demo', '000000000');
      INSERT INTO almacenes (empresa_id, nombre) VALUES (1, 'Almacén Principal');
      INSERT INTO categorias (empresa_id, nombre) VALUES (1, 'General');
      INSERT INTO puntos_venta (empresa_id, nombre, codigo_corto, almacen_id, tipo_registro) 
        VALUES (1, 'Punto de Venta 1', 'PV1', 1, 'almacen');
      
      -- Usuario admin por defecto (PIN: 1234)
      INSERT INTO usuarios (empresa_id, nombre, email, pin, rol, punto_venta_id) 
        VALUES (1, 'Administrador', 'admin@merkadito.cu', '$2a$10$rQEY7z9xK8JqN5hF6LqMZe8vQ9X2wR1tY3uI4oP5aS6dF7gH8jK9l', 'admin', NULL);
      
      -- Usuario vendedor demo (PIN: 0000)
      INSERT INTO usuarios (empresa_id, nombre, email, pin, rol, punto_venta_id) 
        VALUES (1, 'Vendedor Demo', 'vendedor@merkadito.cu', '$2a$10$YgY5z8xK7JqN4hF5LqLYe7vQ8X1wR0tY2uI3oP4aS5dF6gH7jK8l', 'vendedor', 1);
      
      -- Productos demo
      INSERT INTO productos (empresa_id, codigo, nombre, unidad, stock_actual, stock_minimo, costo, precio, categoria_id) VALUES
        (1, '001', 'Arroz 1lb', 'unidad', 100, 20, 0.50, 0.80, 1),
        (1, '002', 'Frijoles 1lb', 'unidad', 50, 10, 0.60, 0.90, 1),
        (1, '003', 'Aceite 500ml', 'unidad', 30, 5, 1.20, 1.80, 1),
        (1, '004', 'Café 250g', 'unidad', 40, 10, 2.00, 3.00, 1),
        (1, '005', 'Azúcar 1lb', 'unidad', 80, 15, 0.40, 0.65, 1);
      
      -- Configuración por defecto
      INSERT INTO configuracion (clave, valor, empresa_id) VALUES
        ('sync_enabled', 'false', 1),
        ('sync_interval_hours', '6', 1),
        ('backup_enabled', 'true', 1);
    `);
  }

  console.log('✅ Base de datos inicializada correctamente en:', DB_PATH);
  
  return db;
}

module.exports = { initDatabase, DB_PATH };
