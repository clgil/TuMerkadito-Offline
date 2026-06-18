# Manual de Usuario - Tu Merkadito

## Guía Rápida de Inicio

### Primeros Pasos

1. **Iniciar el sistema**: Ejecutar `npm start` en la carpeta backend
2. **Abrir navegador**: Ir a http://localhost:3000
3. **Iniciar sesión**: Usar credenciales demo o crear nuevas

### Roles y Permisos

#### Dueño
- Acceso total al sistema
- Crear/eliminar empresas
- Ver todos los reportes
- Gestionar administradores

#### Administrador
- Gestionar trabajadores
- Crear/editar productos
- Ver ventas y turnos
- Cerrar turnos de otros vendedores
- Exportar respaldos

#### Vendedor
- Acceder al POS
- Abrir/cerrar su turno
- Registrar ventas
- Consultar productos

#### Almacenero
- Gestionar inventario
- Registrar entradas/salidas
- Ver alertas de stock
- Hacer ajustes de inventario

#### Económico
- Solo ver reportes
- No puede modificar datos

---

## Módulo POS (Punto de Venta)

### Cómo Vender

1. **Abrir turno** (si no tiene uno activo):
   - Ir a Turnos → Abrir Turno
   - Ingresar monto inicial de caja

2. **Agregar productos**:
   - Buscar por nombre o código
   - Filtrar por categoría
   - Click en producto para agregar al carrito

3. **Gestionar carrito**:
   - Modificar cantidades con + / -
   - Eliminar items si es necesario
   - Ver total acumulado

4. **Cobrar**:
   - Click en "Cobrar"
   - Seleccionar método de pago
   - Ingresar efectivo recibido (si aplica)
   - Confirmar venta

5. **Ticket**:
   - El ticket se muestra en pantalla
   - Opcional: imprimir o enviar por WhatsApp

### Métodos de Pago

- **Efectivo**: Calcula cambio automáticamente
- **Transferencia**: Registra sin cambio
- **Mixto**: Combina efectivo y transferencia

---

## Gestión de Turnos

### Apertura de Turno

1. Ir a sección "Turnos"
2. Click "Abrir Turno"
3. Ingresar monto inicial (opcional)
4. Confirmar

### Cierre de Turno

1. Ir a sección "Turnos"
2. Click "Cerrar Turno"
3. Ingresar:
   - Efectivo contado en caja
   - Transferencias recibidas
   - Nota de ajuste (opcional)
4. El sistema calcula diferencia automáticamente

### Interpretar Diferencias

- **Positivo**: Sobrante de caja
- **Negativo**: Faltante de caja
- **Cero**: Cuadre perfecto

---

## Inventario

### Productos

**Crear Producto:**
- Código único (opcional)
- Nombre descriptivo
- Unidad (unidad, kg, L, etc.)
- Stock actual y mínimo
- Costo y precio de venta
- Proveedor
- Categoría

**Alertas de Stock:**
- 🔴 Sin stock: 0 unidades
- 🟡 Stock crítico: ≤ stock mínimo
- 🟢 Normal: > stock mínimo

### Movimientos

**Entrada (Compra):**
- Aumenta stock
- Actualiza costo promedio
- Registrar proveedor

**Salida (Merma/Daño):**
- Disminuye stock
- Motivo obligatorio

**Ajuste:**
- Corrige stock por conteo físico
- Ingresa stock real, el sistema calcula diferencia

---

## Reportes

### Ventas

- Por período (día, semana, mes)
- Por vendedor
- Por punto de venta
- Por método de pago

### Inventario

- Stock actual valorizado
- Productos más vendidos
- Alertas de stock
- Movimientos históricos

### Turnos

- Historial de aperturas/cierres
- Diferencias de caja
- Rendimiento por vendedor

### Exportar Datos

1. Ir a Reportes
2. Seleccionar período
3. Click "Exportar"
4. Descargar archivo ZIP con:
   - Base de datos SQLite
   - CSV de productos
   - CSV de ventas

---

## Modo Offline

### ¿Qué pasa si se va el internet?

✅ **El sistema sigue funcionando normalmente**
- Las ventas se guardan localmente
- El inventario se actualiza
- Los turnos continúan

### ¿Qué pasa si se apaga el servidor?

✅ **No se pierden datos**
- La base de datos usa WAL (Write-Ahead Log)
- Al reiniciar, verifica integridad
- Los turnos activos permanecen abiertos

### ¿Qué pasa si se apaga la tablet/PC del POS?

✅ **Se recupera la sesión**
- El carrito se guarda temporalmente
- Al volver, pregunta si recuperar
- El turno sigue activo

---

## Consejos para Cuba

### Hardware Recomendado

**Servidor Local:**
- Laptop vieja con Linux (Xubuntu)
- Raspberry Pi 4 con SSD USB
- Mini PC Intel NUC

**Alimentación:**
- UPS pequeño para el servidor
- Batería portátil 12V 7Ah
- Power banks para tablets/celulares

**Red:**
- Router WiFi básico sin necesidad de internet
- IP fija para el servidor
- Tablets/celulares se conectan al WiFi local

### Mejores Prácticas

1. **Respaldos diarios**: Exportar datos al final del día
2. **Dispositivo cargado**: Mantener tablets cargadas antes del turno
3. **Monto inicial**: Siempre registrar monto inicial de turno
4. **Cuadre diario**: Cerrar turnos y cuadrar caja
5. **Actualizaciones**: Sincronizar con nube cuando haya internet

---

## Preguntas Frecuentes

### ¿Necesito internet para usar el sistema?
**No**, el sistema funciona 100% offline. Internet solo es necesario para sincronización opcional con la nube.

### ¿Puedo usar el sistema en múltiples dispositivos?
**Sí**, todos los dispositivos se conectan al servidor local via WiFi.

### ¿Qué pasa si dos vendedores venden el mismo producto al mismo tiempo?
El sistema maneja bloqueos a nivel de base de datos. Si no hay stock suficiente, la segunda venta fallará.

### ¿Cómo recupero datos después de un apagón?
Simplemente reinicia el servidor. La base de datos verifica automáticamente su integridad.

### ¿Puedo cambiar el PIN de un usuario?
**Sí**, desde el panel de administración (rol Admin o Dueño).

### ¿El sistema imprime tickets?
**Sí**, soporta impresoras térmicas USB/Bluetooth. También muestra ticket en pantalla.

---

## Soporte Técnico

Para asistencia técnica:
1. Verificar logs del servidor
2. Revisar conexión a la base de datos
3. Reiniciar servicio
4. Restaurar desde respaldo si es necesario

**Contacto:** soporte@merkadito.cu

---

*Documento versión 1.0 - Junio 2024*
