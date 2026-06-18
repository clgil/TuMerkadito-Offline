// Tu Merkadito - Modern UI App Controller

const API_BASE = '/api/v1';
let currentUser = null;
let sidebarCollapsed = false;

// Títulos de las vistas
const VIEW_TITLES = {
  'login': '🛒 Tu Merkadito',
  'dashboard': 'Dashboard',
  'pos': 'Punto de Venta',
  'turnos': 'Turnos',
  'inventario': 'Inventario',
  'reportes': 'Reportes',
  'configuracion': 'Configuración',
  'usuarios': 'Usuarios',
  'productos': 'Productos',
  'clientes': 'Clientes'
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
  if (!container) return;
  
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

// Sidebar Toggle
function initSidebarToggle() {
  const toggleBtn = $('#sidebar-toggle');
  const sidebar = $('#app-sidebar');
  
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      // En móvil
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
      } else {
        // En desktop
        sidebar.classList.toggle('collapsed');
        sidebarCollapsed = !sidebarCollapsed;
      }
    });
  }
}

// Navegación
function initNavigation() {
  // Sidebar items
  $$('.sidebar-item[data-navigate]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = item.dataset.navigate;
      
      // Actualizar activo
      $$('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Navegar
      showView(viewId);
      
      // Cerrar sidebar en móvil
      if (window.innerWidth <= 768) {
        $('#app-sidebar')?.classList.remove('mobile-open');
      }
    });
  });
  
  // Quick action buttons
  $$('.quick-action-btn[data-navigate]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = btn.dataset.navigate;
      showView(viewId);
    });
  });
}

// Mostrar vista
function showView(viewId) {
  // Ocultar todas las vistas
  $$('.view').forEach(v => v.classList.remove('active'));
  
  // Mostrar vista objetivo
  const target = $(`#view-${viewId}`);
  if (target) {
    target.classList.add('active');
  }
  
  // Actualizar título de página
  updatePageTitle(viewId);
  
  // Actualizar navegación activa
  updateNavigationActive(viewId);
  
  // Cargar datos según vista
  loadViewData(viewId);
}

function updatePageTitle(viewId) {
  const title = VIEW_TITLES[viewId] || 'Tu Merkadito';
  document.title = `${title} - Tu Merkadito`;
}

function updateNavigationActive(viewId) {
  $$('.sidebar-item[data-navigate]').forEach(item => {
    item.classList.toggle('active', item.dataset.navigate === viewId);
  });
}

function loadViewData(viewId) {
  switch(viewId) {
    case 'dashboard':
      loadDashboard && loadDashboard();
      break;
    case 'pos':
      loadPOS && loadPOS();
      break;
    case 'turnos':
      loadTurnosView && loadTurnosView();
      break;
    case 'inventario':
      loadInventario && loadInventario();
      break;
    case 'reportes':
      loadReportes && loadReportes();
      break;
    case 'usuarios':
      loadUsuarios && loadUsuarios();
      break;
    case 'productos':
      loadProductos && loadProductos();
      break;
    case 'clientes':
      loadClientes && loadClientes();
      break;
    case 'configuracion':
      loadConfiguracion && loadConfiguracion();
      break;
  }
}

// Usuario
function updateUserDisplay(user) {
  if (!user) return;
  
  const initials = user.nombre?.charAt(0).toUpperCase() || 'U';
  const name = user.nombre || user.email || 'Usuario';
  
  // Sidebar
  const sidebarAvatar = $('#sidebar-user-avatar');
  const sidebarName = $('#sidebar-user-name');
  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  if (sidebarName) sidebarName.textContent = name;
  
  // Header
  const headerAvatar = $('#header-user-avatar');
  const headerName = $('#header-user-name');
  if (headerAvatar) headerAvatar.textContent = initials;
  if (headerName) headerName.textContent = name.split(' ')[0];
  
  // Mostrar sección admin si es admin
  const adminSection = $('#sidebar-admin-section');
  if (adminSection) {
    adminSection.style.display = user.rol === 'admin' ? 'block' : 'none';
  }
}

// Logout
function initLogout() {
  $('#sidebar-logout')?.addEventListener('click', () => {
    logout();
  });
}

function logout() {
  currentUser = null;
  localStorage.removeItem('tm_user');
  localStorage.removeItem('tm_token');
  
  $('#app-layout').style.display = 'none';
  $('#view-login').classList.add('active');
  
  showToast('Sesión cerrada correctamente');
}

// Login
function initLogin() {
  const loginForm = $('#login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = $('#login-email').value;
      const pin = $('#login-pin').value;
      const errorDiv = $('#login-error');
      
      showLoading(true);
      errorDiv.classList.remove('visible');
      
      try {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, pin })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          currentUser = data.user;
          localStorage.setItem('tm_user', JSON.stringify(currentUser));
          localStorage.setItem('tm_token', data.token);
          
          $('#view-login').classList.remove('active');
          $('#app-layout').style.display = 'flex';
          
          updateUserDisplay(currentUser);
          showView('dashboard');
          showToast('¡Bienvenido!');
        } else {
          errorDiv.textContent = data.error || 'Credenciales inválidas';
          errorDiv.classList.add('visible');
        }
      } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Error de conexión. Verifica el servidor.';
        errorDiv.classList.add('visible');
      } finally {
        showLoading(false);
      }
    });
  }
}

// Check sesión existente
function checkExistingSession() {
  const savedUser = localStorage.getItem('tm_user');
  const token = localStorage.getItem('tm_token');
  
  if (savedUser && token) {
    try {
      currentUser = JSON.parse(savedUser);
      $('#view-login').classList.remove('active');
      $('#app-layout').style.display = 'flex';
      updateUserDisplay(currentUser);
      showView('dashboard');
      return true;
    } catch (e) {
      localStorage.removeItem('tm_user');
      localStorage.removeItem('tm_token');
    }
  }
  return false;
}

// Dashboard
function loadDashboard() {
  // Stats mock - reemplazar con datos reales
  $('#stat-ventas-hoy').textContent = '$1,234.56';
  $('#stat-ingresos').textContent = '$5,678.90';
  $('#stat-turnos').textContent = '2';
  $('#stat-alertas').textContent = '3';
  
  // Actividad reciente mock
  const activityFeed = $('#activity-feed');
  if (activityFeed) {
    activityFeed.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.75rem;">
        <div style="display:flex;gap:0.75rem;align-items:center;padding:0.75rem;background:var(--bg-main);border-radius:var(--radius-md);">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;">💰</div>
          <div>
            <div style="font-weight:500;font-size:13px;">Venta realizada</div>
            <div style="font-size:12px;color:var(--text-muted);">Hace 5 minutos - $45.00</div>
          </div>
        </div>
        <div style="display:flex;gap:0.75rem;align-items:center;padding:0.75rem;background:var(--bg-main);border-radius:var(--radius-md);">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--success-bg);color:var(--success);display:flex;align-items:center;justify-content:center;">✅</div>
          <div>
            <div style="font-weight:500;font-size:13px;">Turno abierto</div>
            <div style="font-size:12px;color:var(--text-muted);">Hace 1 hora - Carlos</div>
          </div>
        </div>
        <div style="display:flex;gap:0.75rem;align-items:center;padding:0.75rem;background:var(--bg-main);border-radius:var(--radius-md);">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--warning-bg);color:var(--warning);display:flex;align-items:center;justify-content:center;">⚠️</div>
          <div>
            <div style="font-weight:500;font-size:13px;">Stock bajo</div>
            <div style="font-size:12px;color:var(--text-muted);">Producto X - 5 unidades</div>
          </div>
        </div>
      </div>
    `;
  }
}

// Sync button
function initSync() {
  $('#header-sync-btn')?.addEventListener('click', async () => {
    showToast('Sincronizando...', 'info');
    // Implementar lógica de sincronización
    setTimeout(() => {
      showToast('Sincronizado correctamente');
    }, 1500);
  });
}

// Dark mode toggle
function initDarkMode() {
  const configTema = $('#config-tema');
  if (configTema) {
    const savedTheme = localStorage.getItem('tm_theme') || 'light';
    configTema.value = savedTheme;
    applyTheme(savedTheme);
    
    configTema.addEventListener('change', (e) => {
      const theme = e.target.value;
      localStorage.setItem('tm_theme', theme);
      applyTheme(theme);
      showToast(`Tema ${theme} aplicado`);
    });
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    // Auto
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
}

// Config form
function initConfigForm() {
  const configForm = $('#config-form');
  if (configForm) {
    configForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Configuración guardada');
    });
  }
}

// Modal handlers
function initModals() {
  // Close buttons
  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.modal-overlay').classList.remove('active');
    });
  });
  
  // Overlay click
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check session
  if (!checkExistingSession()) {
    $('#app-layout').style.display = 'none';
  }
  
  // Init components
  initLogin();
  initLogout();
  initSidebarToggle();
  initNavigation();
  initSync();
  initDarkMode();
  initConfigForm();
  initModals();
  
  // Responsive sidebar close on overlay
  $('#drawer-overlay')?.addEventListener('click', () => {
    $('#app-sidebar')?.classList.remove('mobile-open');
  });
});

// Expose functions globally for other modules
window.showView = showView;
window.showToast = showToast;
window.showLoading = showLoading;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.updateUserDisplay = updateUserDisplay;
window.loadDashboard = loadDashboard;
