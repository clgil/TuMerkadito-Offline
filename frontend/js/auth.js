// Tu Merkadito - Autenticación

document.addEventListener('DOMContentLoaded', () => {
  // Verificar si hay parámetro session_expired en la URL (hash para SPA)
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.replace('#', ''));
  const sessionExpired = urlParams.get('session_expired') === 'true' || 
                         new URLSearchParams(window.location.search).get('session_expired') === 'true';
  
  if (sessionExpired) {
    // Mostrar mensaje de sesión expirada en el formulario de login
    const alertDiv = $('#session-expired-alert');
    if (alertDiv) {
      alertDiv.style.display = 'block';
      alertDiv.setAttribute('role', 'alert');
    }
    // Limpiar parámetro del hash sin recargar
    if (hash.includes('session_expired')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
  
  const loginForm = $('#login-form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = $('#login-email').value.trim();
      const pin = $('#login-pin').value.trim();
      const errorDiv = $('#login-error');
      const alertDiv = $('#session-expired-alert');
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      
      if (!email || !pin) {
        showError('Email y PIN son requeridos');
        return;
      }
      
      // Deshabilitar botón durante petición
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando...';
      errorDiv.classList.remove('visible');
      if (alertDiv) alertDiv.style.display = 'none';
      
      try {
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, pin })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Error en login');
        }
        
        // Guardar sesión
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        showToast('¡Bienvenido! ' + data.user.nombre);
        
        // Limpiar cualquier parámetro de sesión expirada
        if (window.location.hash.includes('session_expired') || 
            window.location.search.includes('session_expired')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Iniciar aplicación
        initApp();
        
      } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Error de conexión');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
      }
    });
  }
  
  // Permitir Enter para enviar formulario
  $('#login-pin')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loginForm.dispatchEvent(new Event('submit'));
    }
  });
});

function showError(message) {
  const errorDiv = $('#login-error');
  errorDiv.textContent = '❌ ' + message;
  errorDiv.classList.add('visible');
  
  // Accesibilidad: anunciar error a lectores de pantalla
  errorDiv.setAttribute('role', 'alert');
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

function initApp() {
  // Esta función es llamada desde app.js
  if (typeof showView === 'function') {
    showView('dashboard');
  }
}
