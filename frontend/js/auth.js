// Tu Merkadito - Autenticación

$('#login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = $('#login-email').value;
  const pin = $('#login-pin').value;
  const errorEl = $('#login-error');
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, pin })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }
    
    // Guardar token y usuario
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    errorEl.classList.remove('visible');
    showToast('¡Bienvenido!', 'success');
    
    // Iniciar aplicación
    initApp();
    
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = error.message;
    errorEl.classList.add('visible');
  }
});

// Verificar token al cargar
async function verifyToken() {
  const token = localStorage.getItem('auth_token');
  
  if (!token) return false;
  
  try {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    return data.valid;
  } catch (error) {
    return false;
  }
}
