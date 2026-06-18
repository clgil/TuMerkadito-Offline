// Tu Merkadito - Aplicación Principal

const API_BASE = '/api/v1';
let currentUser = null;
let currentTurno = null;

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

function showView(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  const target = $(`#view-${viewId}`);
  if (target) {
    target.classList.add('active');
    target.focus();
  }
  
  // Cargar datos según vista
  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'pos') loadPOS();
  if (viewId === 'turnos') loadTurnosView();
  if (viewId === 'inventario') loadInventario();
  if (viewId === 'reportes') loadReportes();
  if (viewId === 'usuarios') loadUsuarios && loadUsuarios();
  if (viewId === 'productos') loadProductos && loadProductos();
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

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// Navegación
function setupNavigation() {
  $$('[data-navigate]').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.navigate);
    });
  });
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
  
  $('#btn-logout')?.addEventListener('click', logout);
});

function initApp() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  currentUser = user;
  
  $('#user-info').textContent = `${user.nombre || ''} (${user.rol || ''})`;
  showView('dashboard');
  loadDashboard();
}

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  currentUser = null;
  showView('login');
  $('#user-info').textContent = '';
  showToast('Sesión cerrada correctamente');
}
