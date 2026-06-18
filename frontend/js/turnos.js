// Tu Merkadito - Gestión de Turnos

async function loadTurnosView() {
  await checkTurnoActivo();
  renderTurnoActivo();
  await loadTurnosHistorial();
}

function renderTurnoActivo() {
  const container = $('#turno-activo-info');
  const btnAbrir = $('#btn-abrir-turno');
  const btnCerrar = $('#btn-cerrar-turno');
  
  if (currentTurno) {
    container.innerHTML = `
      <div class="dashboard-card" style="border-left-color: var(--success-color)">
        <h3>Turno Activo #${currentTurno.id}</h3>
        <p><strong>Punto de Venta:</strong> ${currentTurno.punto_venta_nombre}</p>
        <p><strong>Apertura:</strong> ${formatDate(currentTurno.fecha_apertura)}</p>
        <p><strong>Monto Inicial:</strong> ${formatCurrency(currentTurno.monto_inicial)}</p>
        <p><strong>Ventas:</strong> ${currentTurno.cantidad_ventas || 0} (${formatCurrency(currentTurno.total_ventas || 0)})</p>
      </div>
    `;
    
    btnAbrir.disabled = true;
    btnCerrar.disabled = false;
  } else {
    container.innerHTML = '<p>No hay turnos activos en este momento.</p>';
    btnAbrir.disabled = false;
    btnCerrar.disabled = true;
  }
}

$('#btn-abrir-turno')?.addEventListener('click', async () => {
  await openTurno();
  renderTurnoActivo();
});

$('#btn-cerrar-turno')?.addEventListener('click', async () => {
  if (!currentTurno) return;
  
  const montoEfectivo = prompt('Ingrese el monto total en efectivo contado:') || '0';
  const montoTransferencia = prompt('Ingrese el monto total en transferencias (si aplica, 0 si no):') || '0';
  const notaAjuste = prompt('Nota para el ajuste (opcional):') || '';
  
  try {
    const response = await apiFetch('/turnos/cerrar', {
      method: 'POST',
      body: JSON.stringify({
        turno_id: currentTurno.id,
        monto_efectivo: parseFloat(montoEfectivo),
        monto_transferencias: parseFloat(montoTransferencia),
        nota_ajuste: notaAjuste
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast(`Turno cerrado. Diferencia: ${formatCurrency(data.resumen.diferencia)}`, 'success');
      currentTurno = null;
      renderTurnoActivo();
      await loadTurnosHistorial();
    } else {
      showToast(data.error, 'error');
    }
  } catch (error) {
    showToast('Error al cerrar turno', 'error');
  }
});

async function loadTurnosHistorial() {
  try {
    const response = await apiFetch('/turnos/historial?limite=50');
    const turnos = await response.json();
    
    const tbody = $('#turnos-table-body');
    
    if (turnos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No hay turnos registrados</td></tr>';
      return;
    }
    
    tbody.innerHTML = turnos.map(t => `
      <tr>
        <td>${formatDate(t.fecha_apertura)}</td>
        <td>${t.vendedor_nombre}</td>
        <td>${t.punto_venta_nombre}</td>
        <td>${formatCurrency(t.monto_inicial)}</td>
        <td>${formatCurrency(t.monto_esperado || 0)}</td>
        <td>${formatCurrency((t.monto_efectivo || 0) + (t.monto_transferencias || 0))}</td>
        <td style="color: ${(t.ajuste || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
          ${formatCurrency(t.ajuste || 0)}
        </td>
        <td>
          <span style="padding: 0.25rem 0.5rem; border-radius: 4px; background: ${t.estado === 'cerrado' ? '#D1FAE5' : '#FEF3C7'}; color: ${t.estado === 'cerrado' ? '#065F46' : '#92400E'}; font-size: 0.75rem;">
            ${t.estado}
          </span>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error cargando historial:', error);
  }
}
