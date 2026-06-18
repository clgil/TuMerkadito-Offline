// Tu Merkadito - Aplicación principal

const API_BASE = '/api/v1';
let currentUser = null;
let currentTurno = null;

// Utilidades
function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

function formatCurrency(amount) {
  return '$' + parseFloat(amount).toFixed(2);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CU') + ' ' + date.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message, type = 'success') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function showView(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${viewId}`).classList.add('active');
}

// Verificar conexión
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
      const view = btn.dataset.navigate;
      showView(view);
      
      // Cargar datos según la vista
      if (view === 'dashboard') loadDashboard();
      if (view === 'pos') loadPOS();
      if (view === 'turnos') loadTurnosView();
      if (view === 'inventario') loadInventario();
      if (view === 'reportes') loadReportes();
    });
  });
}

// Dashboard
async function loadDashboard() {
  try {
    const response = await apiFetch('/reportes/resumen');
    const data = await response.json();
    
    const cards = [
      { title: 'Ventas Hoy', value: formatCurrency(data.ventas.total), color: 'primary' },
      { title: 'Transacciones', value: data.ventas.cantidad, color: 'success' },
      { title: 'Turnos Activos', value: data.turnos_activos, color: 'warning' },
      { title: 'Alertas Stock', value: data.alertas_stock, color: 'danger' }
    ];
    
    $('#dashboard-cards').innerHTML = cards.map(card => `
      <div class="dashboard-card" style="border-left-color: var(--${card.color}-color)">
        <h3>${card.title}</h3>
        <div class="value">${card.value}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}

// API Fetch con manejo de autenticación
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
  
  // Verificar si hay sesión activa
  const savedUser = localStorage.getItem('user');
  const savedToken = localStorage.getItem('auth_token');
  
  if (savedUser && savedToken) {
    currentUser = JSON.parse(savedUser);
    initApp();
  } else {
    showView('login');
  }
  
  // Botón logout
  $('#btn-logout')?.addEventListener('click', logout);
});

function initApp() {
  const user = JSON.parse(localStorage.getItem('user'));
  currentUser = user;
  
  $('#user-info').textContent = `${user.nombre} (${user.rol})`;
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
