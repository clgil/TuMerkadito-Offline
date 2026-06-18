// Tu Merkadito - Reportes

async function loadReportes() {
  // Establecer fechas por defecto (mes actual)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  $('#reporte-desde').valueAsDate = firstDay;
  $('#reporte-hasta').valueAsDate = today;
}

$('#btn-generar-reporte')?.addEventListener('click', async () => {
  const fechaDesde = $('#reporte-desde').value;
  const fechaHasta = $('#reporte-hasta').value;
  
  if (!fechaDesde || !fechaHasta) {
    showToast('Seleccione un rango de fechas', 'warning');
    return;
  }
  
  try {
    const response = await apiFetch(`/reportes/ventas?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`);
    const reporte = await response.json();
    
    renderReporte(reporte);
  } catch (error) {
    console.error('Error generando reporte:', error);
    showToast('Error al generar reporte', 'error');
  }
});

function renderReporte(reporte) {
  const container = $('#reporte-resultado');
  
  if (reporte.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 2rem;">No hay datos en el período seleccionado</p>';
    return;
  }
  
  // Calcular totales
  const totalVentas = reporte.reduce((sum, r) => sum + r.total_ventas, 0);
  const totalTransacciones = reporte.reduce((sum, r) => sum + r.cantidad_ventas, 0);
  const promedioVenta = totalVentas / totalTransacciones;
  
  container.innerHTML = `
    <div class="dashboard-cards" style="margin-bottom: 2rem;">
      <div class="dashboard-card">
        <h3>Total Ventas</h3>
        <div class="value">${formatCurrency(totalVentas)}</div>
      </div>
      <div class="dashboard-card">
        <h3>Transacciones</h3>
        <div class="value">${totalTransacciones}</div>
      </div>
      <div class="dashboard-card">
        <h3>Promedio por Venta</h3>
        <div class="value">${formatCurrency(promedioVenta)}</div>
      </div>
    </div>
    
    <table class="data-table">
      <thead>
        <tr>
          <th>Período</th>
          <th>Ventas</th>
          <th>Total</th>
          <th>Efectivo</th>
          <th>Transferencia</th>
          <th>Promedio</th>
        </tr>
      </thead>
      <tbody>
        ${reporte.map(r => `
          <tr>
            <td>${r.periodo}</td>
            <td>${r.cantidad_ventas}</td>
            <td>${formatCurrency(r.total_ventas)}</td>
            <td>${formatCurrency(r.total_efectivo)}</td>
            <td>${formatCurrency(r.total_transferencia)}</td>
            <td>${formatCurrency(r.promedio_venta)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

$('#btn-exportar')?.addEventListener('click', async () => {
  try {
    const response = await apiFetch('/sync/exportar', {
      method: 'POST'
    });
    
    if (response.ok) {
      // El navegador manejará la descarga automáticamente
      showToast('Exportando datos...', 'success');
    } else {
      const data = await response.json();
      showToast(data.error || 'Error al exportar', 'error');
    }
  } catch (error) {
    console.error('Error exportando:', error);
    showToast('Error al exportar datos', 'error');
  }
});
