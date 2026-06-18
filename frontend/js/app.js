// Tu Merkadito - Aplicación Principal

const API_BASE = '/api/v1';
let currentUser = null;
// currentTurno se maneja en el módulo de turnos/pos

// Títulos de las vistas para el header
const VIEW_TITLES = {
  'login': '🛒 Tu Merkadito',
  'dashboard': '🏠 Panel de Control',
  'pos': '🛒 Punto de Venta',
  'turnos': '⏰ Gestión de Turnos',
  'inventario': '📦 Inventario',
  'reportes': '📊 Reportes',
  'configuracion': '⚙️ Configuración',
  'trabajadores': '👥 Trabajadores',
  'puntos-venta': '🏪 Puntos de Venta',
  'usuarios': '🔐 Usuarios',
  'productos': '🏷️ Productos'
};

// Utilidades
function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function formatCurrency(amount) {
  return '$' + parseFloat(amount || 0).toFixed(2);
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CU') + ' ' + date.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message, type = 'success') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showLoading(show = true) {
  const overlay = $('#loading-overlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function updateHeaderTitle(viewId) {
  const titleEl = $('#header-title');
  if (titleEl) {
    titleEl.textContent = VIEW_TITLES[viewId] || '🛒 Tu Merkadito';
  }
}

function showView(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  const target = $(`#view-${viewId}`);
  if (target) {
    target.classList.add('active');
    target.focus();
  }
  
  // Actualizar título del header
  updateHeaderTitle(viewId);
  
  // Actualizar navegación activa
  updateNavigation(viewId);
  
  // Cargar datos según vista
  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'pos') loadPOS();
  if (viewId === 'turnos') loadTurnosView();
  if (viewId === 'inventario') loadInventario();
  if (viewId === 'reportes') loadReportes();
  if (viewId === 'usuarios') loadUsuarios && loadUsuarios();
  if (viewId === 'productos') loadProductos && loadProductos();
  if (viewId === 'configuracion') loadConfiguracion && loadConfiguracion();
  if (viewId === 'trabajadores') loadTrabajadores && loadTrabajadores();
  if (viewId === 'puntos-venta') loadPuntosVenta && loadPuntosVenta();
}

function updateNavigation(viewId) {
  // Actualizar bottom nav (solo vistas principales)
  const mainViews = ['dashboard', 'pos', 'turnos', 'inventario', 'reportes'];
  $$('.bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.navigate === viewId);
  });
  
  // Actualizar drawer items
  $$('.drawer-item[data-navigate]').forEach(item => {
    item.classList.toggle('active', item.dataset.navigate === viewId);
  });
}

// Drawer functionality
function toggleDrawer(open = true) {
  const drawer = $('#app-drawer');
  const overlay = $('#drawer-overlay');
  
  if (open) {
    drawer.classList.add('active');
    overlay.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
  } else {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
  }
}

// Estado de conexión
function updateConnectionStatus() {
  const statusEl = $('#connection-status');
  const isOnline = navigator.onLine;
  
  if (isOnline) {
    statusEl.classList.remove('offline');
    statusEl.querySelector('.status-text').textContent = 'En línea';
  } else {
    statusEl.classList.add('offline');
    statusEl.querySelector('.status-text').textContent = 'Sin conexión';
  }
}

// Sync indicator
function updateSyncStatus(status = 'synced', pending = 0) {
  const indicator = $('#sync-indicator');
  const text = indicator.querySelector('.sync-text');
  
  indicator.classList.remove('syncing', 'error');
  
  if (status === 'syncing') {
    indicator.classList.add('syncing');
    text.textContent = 'Sincronizando...';
  } else if (status === 'error') {
    indicator.classList.add('error');
    text.textContent = 'Error sincronización';
  } else if (pending > 0) {
    text.textContent = `${pending} pendiente(s)`;
  } else {
    text.textContent = 'Sincronizado';
  }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// Navegación
function setupNavigation() {
  // Botón de menú hamburguesa
  $('#header-menu-btn')?.addEventListener('click', () => toggleDrawer(true));
  $('#drawer-close')?.addEventListener('click', () => toggleDrawer(false));
  $('#drawer-overlay')?.addEventListener('click', () => toggleDrawer(false));
  
  // Items del drawer
  $$('.drawer-item[data-navigate]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      showView(item.dataset.navigate);
      toggleDrawer(false);
    });
  });
  
  // Botón de sincronización manual en drawer
  $('#drawer-sync-btn')?.addEventListener('click', () => {
    doManualSync();
    toggleDrawer(false);
  });
  
  // Click en el indicador de sincronización del header también permite sincronizar
  $('#sync-indicator')?.addEventListener('click', () => {
    doManualSync();
  });
  
  // Logout del drawer
  $('#drawer-logout')?.addEventListener('click', logout);
  
  // Bottom nav
  $$('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      showView(item.dataset.navigate);
    });
  });
  
  // Otros botones de navegación
  $$('[data-navigate]').forEach(btn => {
    if (!btn.classList.contains('bottom-nav-item') && !btn.classList.contains('drawer-item')) {
      btn.addEventListener('click', () => {
        showView(btn.dataset.navigate);
      });
    }
  });
}

// Sincronización manual
async function doManualSync() {
  showLoading(true);
  updateSyncStatus('syncing');
  
  try {
    // Simular sincronización - en producción esto llamaría a la API
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Actualizar datos locales si es necesario
    if (currentUser) {
      loadDashboard();
    }
    
    updateSyncStatus('synced');
    showToast('Sincronización completada exitosamente');
  } catch (error) {
    console.error('Error en sincronización:', error);
    updateSyncStatus('error');
    showToast('Error al sincronizar. Intente nuevamente.', 'error');
  } finally {
    showLoading(false);
  }
}

// Dashboard
async function loadDashboard() {
  try {
    const response = await apiFetch('/reportes/resumen');
    const data = await response.json();
    
    const cards = [
      { title: '💰 Ventas Hoy', value: formatCurrency(data.ventas?.total || 0), color: 'primary' },
      { title: '🧾 Transacciones', value: data.ventas?.cantidad || 0, color: 'success' },
      { title: '⏰ Turnos Activos', value: data.turnos_activos || 0, color: 'warning' },
      { title: '⚠️ Alertas Stock', value: data.alertas_stock || 0, color: 'danger' }
    ];
    
    $('#dashboard-cards').innerHTML = cards.map(card => `
      <div class="dashboard-card" style="border-left-color: var(--${card.color})">
        <h3>${card.title}</h3>
        <div class="value">${card.value}</div>
      </div>
    `).join('');
    
    // Mostrar botones según rol
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const esAdmin = ['admin', 'dueño'].includes(user.rol);
    $('#btn-usuarios').style.display = esAdmin ? 'flex' : 'none';
    $('#btn-productos').style.display = esAdmin ? 'flex' : 'none';
    
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    showToast('Error cargando datos del dashboard', 'error');
  }
}

// API Fetch con autenticación
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers
    }
  };
  
  const response = await fetch(`${API_BASE}${endpoint}`, config);
  
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.reload();
    throw new Error('Sesión expirada');
  }
  
  return response;
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  updateConnectionStatus();
  setupNavigation();
  
  const savedUser = localStorage.getItem('user');
  const savedToken = localStorage.getItem('auth_token');
  
  if (savedUser && savedToken) {
    initApp();
  } else {
    showView('login');
  }
});

function initApp() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  currentUser = user;
  
  // Actualizar info de usuario en header y drawer
  $('#user-info').textContent = `${user.nombre || ''} (${user.rol || ''})`;
  $('#drawer-user-name').textContent = `${user.nombre || 'Usuario'}`;
  
  // Mostrar sección admin si corresponde
  const esAdmin = ['admin', 'dueño'].includes(user.rol);
  $('#drawer-admin-section').style.display = esAdmin ? 'block' : 'none';
  
  showView('dashboard');
  loadDashboard();
  
  // Cerrar sesión con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const drawer = $('#app-drawer');
      if (drawer.classList.contains('active')) {
        toggleDrawer(false);
      }
    }
  });
}

// Placeholder functions for new views (pueden ser implementadas después)
function loadConfiguracion() {
  // Cargar configuración desde localStorage o API
  const config = JSON.parse(localStorage.getItem('config') || '{}');
  $('#config-nombre').value = config.nombre || '';
  $('#config-nit').value = config.nit || '';
  $('#config-direccion').value = config.direccion || '';
  $('#config-telefono').value = config.telefono || '';
}

// Guardar configuración
$('#config-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const config = {
    nombre: $('#config-nombre').value,
    nit: $('#config-nit').value,
    direccion: $('#config-direccion').value,
    telefono: $('#config-telefono').value
  };
  localStorage.setItem('config', JSON.stringify(config));
  showToast('Configuración guardada exitosamente');
});

function loadTrabajadores() {
  // Placeholder - implementar carga de trabajadores
  console.log('Cargando trabajadores...');
}

function loadPuntosVenta() {
  // Placeholder - implementar carga de puntos de venta
  console.log('Cargando puntos de venta...');
}

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  currentUser = null;
  $('#user-info').textContent = '';
  $('#drawer-user-name').textContent = 'Usuario';
  showView('login');
  toggleDrawer(false);
  showToast('Sesión cerrada correctamente');
}
