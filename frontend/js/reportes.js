// Tu Merkadito - Módulo de Reportes

document.addEventListener('DOMContentLoaded', () => {
  // Establecer fechas por defecto (últimos 7 días)
  const hoy = new Date();
  const haceSieteDias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  $('#reporte-hasta').valueAsDate = hoy;
  $('#reporte-desde').valueAsDate = haceSieteDias;
  
  $('#btn-generar-reporte')?.addEventListener('click', generarReporte);
  $('#btn-exportar-csv')?.addEventListener('click', exportarCSV);
});

async function loadReportes() {
  // Pre-cargar datos si es necesario
}

async function generarReporte() {
  const desde = $('#reporte-desde')?.value;
  const hasta = $('#reporte-hasta')?.value;
  const tipo = $('#reporte-tipo')?.value || 'ventas';
  
  if (!desde || !hasta) {
    showToast('Seleccione un rango de fechas', 'warning');
    return;
  }
  
  const container = $('#reporte-resultado');
  if (!container) return;
  
  container.innerHTML = '<p style="text-align: center; padding: 2rem;">Cargando reporte...</p>';
  
  try {
    let url = `/reportes/${tipo}?desde=${desde}&hasta=${hasta}`;
    
    const response = await apiFetch(url);
    const data = await response.json();
    
    if (tipo === 'ventas') {
      renderReporteVentas(data, container);
    } else if (tipo === 'turnos') {
      renderReporteTurnos(data, container);
    } else if (tipo === 'inventario') {
      renderReporteInventario(data, container);
    }
    
  } catch (error) {
    console.error('Error generando reporte:', error);
    container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 2rem;">Error: ${error.message}</p>`;
  }
}

function renderReporteVentas(data, container) {
  const ventas = data.ventas || [];
  const total = data.total || 0;
  const cantidad = data.cantidad || 0;
  
  let html = `
    <div class="card">
      <h3>📊 Reporte de Ventas</h3>
      <div class="dashboard-cards" style="margin-bottom: 1.5rem;">
        <div class="dashboard-card">
          <h3>Total Vendido</h3>
          <div class="value">${formatCurrency(total)}</div>
        </div>
        <div class="dashboard-card">
          <h3>Transacciones</h3>
          <div class="value">${cantidad}</div>
        </div>
        <div class="dashboard-card">
          <h3>Promedio por Venta</h3>
          <div class="value">${formatCurrency(cantidad > 0 ? total / cantidad : 0)}</div>
        </div>
      </div>
      
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Vendedor</th>
              <th>PV</th>
              <th>Método</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${ventas.map(v => `
              <tr>
                <td>${formatDate(v.fecha)}</td>
                <td>${v.vendedor_nombre || '-'}</td>
                <td>${v.pv_nombre || '-'}</td>
                <td>${v.metodo_pago || 'efectivo'}</td>
                <td><strong>${formatCurrency(v.total)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

function renderReporteTurnos(data, container) {
  const turnos = data.turnos || [];
  
  let html = `
    <div class="card">
      <h3>⏰ Reporte de Turnos</h3>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha Apertura</th>
              <th>Vendedor</th>
              <th>PV</th>
              <th>Inicial</th>
              <th>Ventas</th>
              <th>Final</th>
              <th>Diferencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${turnos.map(t => {
              const esperado = (t.ventas_total || 0) + t.monto_inicial;
              const diferencia = (t.monto_final || 0) - esperado;
              const diffStyle = diferencia === 0 ? '' : `color: ${diferencia > 0 ? 'var(--success)' : 'var(--danger)'}`;
              
              return `
                <tr>
                  <td>${formatDate(t.fecha_apertura)}</td>
                  <td>${t.vendedor_nombre || '-'}</td>
                  <td>${t.pv_nombre || '-'}</td>
                  <td>${formatCurrency(t.monto_inicial)}</td>
                  <td>${formatCurrency(t.ventas_total || 0)}</td>
                  <td>${formatCurrency(t.monto_final || 0)}</td>
                  <td style="${diffStyle}; font-weight: 600;">${diferencia !== 0 ? formatCurrency(diferencia) : '✓'}</td>
                  <td>${t.estado}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

function renderReporteInventario(data, container) {
  const productos = data.productos || [];
  
  let html = `
    <div class="card">
      <h3>📦 Reporte de Inventario</h3>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Stock Actual</th>
              <th>Stock Mínimo</th>
              <th>Precio</th>
              <th>Valor Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${productos.map(p => {
              const sinStock = p.stock_actual <= 0;
              const bajoStock = p.stock_actual <= p.stock_minimo && p.stock_actual > 0;
              const estadoClass = sinStock ? 'color: var(--danger)' : (bajoStock ? 'color: var(--warning)' : 'color: var(--success)');
              const estadoTexto = sinStock ? 'Sin Stock' : (bajoStock ? 'Bajo Stock' : 'OK');
              
              return `
                <tr>
                  <td>${p.codigo || '-'}</td>
                  <td><strong>${p.nombre}</strong></td>
                  <td>${p.categoria || '-'}</td>
                  <td>${p.stock_actual} ${p.unidad || 'ud'}</td>
                  <td>${p.stock_minimo}</td>
                  <td>${formatCurrency(p.precio)}</td>
                  <td>${formatCurrency(p.stock_actual * p.precio)}</td>
                  <td style="${estadoClass}; font-weight: 600;">${estadoTexto}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

function exportarCSV() {
  const container = $('#reporte-resultado');
  if (!container || !container.querySelector('table')) {
    showToast('Genere un reporte primero', 'warning');
    return;
  }
  
  const table = container.querySelector('table');
  const rows = table.querySelectorAll('tr');
  
  let csv = [];
  rows.forEach(row => {
    const cols = row.querySelectorAll('th, td');
    const rowData = Array.from(cols).map(col => {
      let text = col.textContent.trim().replace(/"/g, '""');
      return `"${text}"`;
    });
    csv.push(rowData.join(','));
  });
  
  const csvContent = csv.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  URL.revokeObjectURL(url);
  showToast('Reporte exportado correctamente');
}
