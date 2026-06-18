// Tu Merkadito - Gestión de Inventario

async function loadInventario() {
  try {
    const response = await apiFetch('/inventario/stock');
    const productos = await response.json();
    
    renderInventario(productos);
    await loadCategorias();
    await loadAlertas();
  } catch (error) {
    console.error('Error cargando inventario:', error);
    showToast('Error al cargar inventario', 'error');
  }
}

function renderInventario(productos) {
  const tbody = $('#inventario-table-body');
  
  if (productos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No hay productos registrados</td></tr>';
    return;
  }
  
  tbody.innerHTML = productos.map(p => `
    <tr>
      <td>${p.codigo || '-'}</td>
      <td>${p.nombre}</td>
      <td style="${p.stock_actual <= p.stock_minimo ? 'color: var(--danger-color); font-weight: bold;' : ''}">
        ${p.stock_actual} ${p.unidad}
      </td>
      <td>${p.stock_minimo}</td>
      <td>${formatCurrency(p.precio)}</td>
      <td>
        ${p.stock_actual === 0 
          ? '<span style="color: var(--danger-color);">Sin stock</span>'
          : p.stock_actual <= p.stock_minimo
            ? '<span style="color: var(--warning-color);">Crítico</span>'
            : '<span style="color: var(--success-color);">Normal</span>'
        }
      </td>
    </tr>
  `).join('');
}

async function loadCategorias() {
  try {
    // Las categorías se pueden obtener de los productos ya cargados
    // O hacer una llamada específica si existe el endpoint
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

async function loadAlertas() {
  try {
    const response = await apiFetch('/inventario/alertas');
    const alertas = await response.json();
    
    const container = $('#inventario-alertas');
    
    if (alertas.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = `
      <div class="alerta alerta-warning">
        <strong>⚠️ ${alertas.length} producto(s) con stock crítico</strong>
      </div>
    `;
  } catch (error) {
    console.error('Error cargando alertas:', error);
  }
}

// Búsqueda en inventario
$('#inventario-search')?.addEventListener('input', async (e) => {
  const term = e.target.value;
  
  try {
    const response = await apiFetch(`/productos?search=${encodeURIComponent(term)}`);
    const productos = await response.json();
    renderInventario(productos);
  } catch (error) {
    console.error('Error buscando productos:', error);
  }
});

// Filtro por categoría
$('#inventario-categoria')?.addEventListener('change', async (e) => {
  const categoria = e.target.value;
  
  try {
    const response = await apiFetch(`/productos?categoria=${categoria}`);
    const productos = await response.json();
    renderInventario(productos);
  } catch (error) {
    console.error('Error filtrando productos:', error);
  }
});
