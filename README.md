# 🛒 Tu Merkadito - Sistema de Gestión Empresarial Offline-First

Sistema de gestión empresarial (inventario, ventas POS, turnos, roles, reportes) diseñado para funcionar **sin internet** el 99% del tiempo, adaptado para Cuba y países con conectividad intermitente.

## 📋 Características Principales

- ✅ **Offline-First**: Funciona sin conexión a internet
- ✅ **Resistente a apagones**: Recupera datos tras reinicios
- ✅ **PWA instalable**: Se instala como app en móviles y tablets
- ✅ **Multi-rol**: Dueño, Admin, Vendedor, Almacenero, Económico
- ✅ **Gestión de turnos**: Apertura y cierre con control de caja
- ✅ **Inventario en tiempo real**: Alertas de stock crítico
- ✅ **Reportes exportables**: PDF/CSV sin necesidad de internet

## 🚀 Instalación Rápida

### Requisitos Previos

- Node.js 18+ instalado
- 500MB de espacio libre
- Sistema operativo: Linux (recomendado), Windows, macOS

### Pasos de Instalación

```bash
# 1. Navegar al directorio del backend
cd backend

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor
npm start
```

El sistema estará disponible en: **http://localhost:3000**

## 👥 Usuarios Demo

| Email | PIN | Rol |
|-------|-----|-----|
| admin@merkadito.cu | 1234 | Administrador |
| vendedor@merkadito.cu | 0000 | Vendedor |

## 📁 Estructura del Proyecto

```
tu-merkadito/
├── backend/
│   ├── server.js           # Servidor principal
│   ├── database.js         # Conexión SQLite
│   ├── scripts/
│   │   └── init-db.js      # Inicialización BD
│   ├── middleware/
│   │   └── auth.js         # Autenticación JWT
│   ├── routes/
│   │   ├── auth.js         # Rutas de autenticación
│   │   ├── productos.js    # CRUD productos
│   │   ├── ventas.js       # Gestión de ventas
│   │   ├── turnos.js       # Turnos (IPV)
│   │   ├── inventario.js   # Movimientos de stock
│   │   └── sync.js         # Sincronización y reportes
│   └── data/
│       └── merkadito.db    # Base de datos SQLite
├── frontend/
│   ├── index.html          # Aplicación principal
│   ├── css/
│   │   └── styles.css      # Estilos
│   ├── js/
│   │   ├── app.js          # Lógica principal
│   │   ├── auth.js         # Autenticación
│   │   ├── pos.js          # Punto de venta
│   │   ├── turnos.js       # Gestión de turnos
│   │   ├── inventario.js   # Inventario
│   │   └── reportes.js     # Reportes
│   ├── manifest.json       # PWA Manifest
│   └── sw.js               # Service Worker
└── docs/
    └── MANUAL_USUARIO.md   # Documentación
```

## 🔧 Configuración Avanzada

### Variables de Entorno

```bash
# Puerto del servidor (default: 3000)
PORT=3000

# Secret para JWT (cambiar en producción)
JWT_SECRET=tu-secret-key-cambia-en-produccion

# Modo (development/production)
NODE_ENV=production
```

### Ejecutar en Segundo Plano (Linux)

```bash
# Usando pm2 (recomendado)
npm install -g pm2
pm2 start backend/server.js --name tu-merkadito
pm2 save
pm2 startup

# O usando systemd
sudo nano /etc/systemd/system/tu-merkadito.service
```

### Respaldo Automático

Los respaldos se pueden generar desde el menú de Reportes → Exportar, o manualmente:

```bash
# Copiar la base de datos
cp backend/data/merkadito.db respaldo_$(date +%Y%m%d).db
```

## 📱 Uso como PWA

1. Abrir el sistema en Chrome/Edge/Firefox
2. Hacer clic en el ícono de instalar en la barra de direcciones
3. La app se instalará y funcionará offline

## 🔐 Seguridad

- Los PINs se almacenan hasheados con bcrypt
- Tokens JWT con expiración de 8 horas
- Roles bien definidos con permisos específicos
- Base de datos local protegida

## 🆘 Solución de Problemas

### El servidor no inicia

```bash
# Verificar que Node.js esté instalado
node --version

# Reinstalar dependencias
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Error de base de datos

```bash
# Eliminar y recrear la BD
rm backend/data/merkadito.db*
npm run init-db  # o node scripts/init-db.js
```

### No puedo acceder desde otros dispositivos

- Verificar firewall: `sudo ufw allow 3000`
- Asegurar que el servidor escuche en 0.0.0.0
- Verificar IP local: `ip addr show`

## 📄 Licencia

MIT License - Libre uso para fines comerciales y educativos.

## 🤝 Soporte

Para reportar errores o solicitar características, crear un issue en el repositorio.

---

**Hecho con ❤️ para Cuba y el mundo**
