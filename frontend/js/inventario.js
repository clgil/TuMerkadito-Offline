// Tu Merkadito - Módulo de Inventario

document.addEventListener('DOMContentLoaded', () => {
  $('#inventario-search')?.addEventListener('input', filtrarInventario);
  $('#btn-nuevo-producto')?.addEventListener('click', () => {
    showToast('Funcionalidad para administradores', 'warning');
  });
});

async function loadInventario() {
  try {
    const response = await apiFetch('/productos?activo=1');
    const data = await response.json();
    
    const productos = data.productos || data;
    renderInventario(productos);
    cargarCategoriasInventario(productos);
    mostrarAlertasStock(productos);
    
  } catch (error) {
    console.error('Error cargando inventario:', error);
    showToast('Error cargando inventario', 'error');
  }
}

function renderInventario(productos) {
  const tbody = $('#inventario-table-body');
  if (!tbody) return;
  
  if (productos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No hay productos registrados</td></tr>';
    return;
  }
  
  tbody.innerHTML = productos.map(p => {
    const sinStock = p.stock_actual <= 0;
    const bajoStock = p.stock_actual <= p.stock_minimo && p.stock_actual > 0;
    const estadoClass = sinStock ? 'color: var(--danger)' : (bajoStock ? 'color: var(--warning)' : 'color: var(--success)');
    const estadoTexto = sinStock ? 'Sin Stock' : (bajoStock ? 'Bajo Stock' : 'OK');
    
    return `
      <tr>
        <td>${p.codigo || '-'}</td>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.stock_actual} ${p.unidad || 'ud'}</td>
        <td>${p.stock_minimo}</td>
        <td>${formatCurrency(p.precio)}</td>
        <td style="${estadoClass}; font-weight: 600;">${estadoTexto}</td>
      </tr>
    `;
  }).join('');
}

function cargarCategoriasInventario(productos) {
  const select = $('#inventario-categoria');
  if (!select) return;
  
  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
  
  select.innerHTML = `
    <option value="">Todas las categorías</option>
    ${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
  `;
  
  select.addEventListener('change', () => {
    filtrarInventario();
  });
}

function mostrarAlertasStock(productos) {
  const container = $('#inventario-alertas');
  if (!container) return;
  
  const sinStock = productos.filter(p => p.stock_actual <= 0);
  const bajoStock = productos.filter(p => p.stock_actual <= p.stock_minimo && p.stock_actual > 0);
  
  let html = '';
  
  if (sinStock.length > 0) {
    html += `
      <div class="alerta alerta-danger">
        ⚠️ <strong>${sinStock.length} producto(s) sin stock:</strong> 
        ${sinStock.slice(0, 5).map(p => p.nombre).join(', ')}${sinStock.length > 5 ? '...' : ''}
      </div>
    `;
  }
  
  if (bajoStock.length > 0) {
    html += `
      <div class="alerta alerta-warning">
        ⚡ <strong>${bajoStock.length} producto(s) con stock bajo:</strong> 
        ${bajoStock.slice(0, 5).map(p => p.nombre).join(', ')}${bajoStock.length > 5 ? '...' : ''}
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function filtrarInventario() {
  const search = ($('#inventario-search')?.value || '').toLowerCase();
  const categoria = $('#inventario-categoria')?.value || '';
  
  // Recargar y filtrar
  apiFetch('/productos?activo=1')
    .then(r => r.json())
    .then(data => {
      let productos = data.productos || data;
      
      if (search) {
        productos = productos.filter(p => 
          p.nombre.toLowerCase().includes(search) ||
          (p.codigo && p.codigo.toLowerCase().includes(search))
        );
      }
      
      if (categoria) {
        productos = productos.filter(p => p.categoria === categoria);
      }
      
      renderInventario(productos);
    })
    .catch(err => console.error('Error filtrando:', err));
}
