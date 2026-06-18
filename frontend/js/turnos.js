// Tu Merkadito - Módulo de Turnos

document.addEventListener('DOMContentLoaded', () => {
  $('#btn-abrir-turno')?.addEventListener('click', abrirTurno);
  $('#btn-cerrar-turno')?.addEventListener('click', cerrarTurno);
});

async function loadTurnosView() {
  await checkTurnoActivo();
  await loadTurnosHistorial();
}

async function checkTurnoActivo() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const response = await apiFetch(`/turnos/activo?vendedor_id=${user.id}`);
    const data = await response.json();
    
    const banner = $('#turno-activo-banner');
    const btnAbrir = $('#btn-abrir-turno');
    const btnCerrar = $('#btn-cerrar-turno');
    
    if (data.turno) {
      // Hay turno activo
      if (banner) {
        banner.innerHTML = `
          <strong>✅ Turno #${data.turno.id} Activo</strong><br>
          Apertura: ${formatDate(data.turno.fecha_apertura)}<br>
          Caja inicial: ${formatCurrency(data.turno.monto_inicial)}<br>
          Ventas actuales: ${formatCurrency(data.turno.ventas_total || 0)}
        `;
      }
      
      if (btnAbrir) btnAbrir.disabled = true;
      if (btnCerrar) btnCerrar.disabled = false;
      
      currentTurno = data.turno;
    } else {
      // No hay turno
      if (banner) {
        banner.innerHTML = `
          <strong>⚠️ Sin Turno Activo</strong><br>
          Debe abrir un turno para comenzar a vender
        `;
      }
      
      if (btnAbrir) btnAbrir.disabled = false;
      if (btnCerrar) btnCerrar.disabled = true;
      
      currentTurno = null;
    }
    
  } catch (error) {
    console.error('Error verificando turno:', error);
  }
}

async function abrirTurno() {
  const montoInicial = prompt('Monto inicial en caja (CUP):', '0');
  if (montoInicial === null) return;
  
  const monto = parseFloat(montoInicial) || 0;
  if (monto < 0) {
    showToast('El monto inicial no puede ser negativo', 'error');
    return;
  }
  
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const response = await apiFetch('/turnos', {
      method: 'POST',
      body: JSON.stringify({
        punto_venta_id: user.punto_venta_id,
        vendedor_id: user.id,
        monto_inicial: monto
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Error al abrir turno');
    }
    
    showToast('Turno abierto exitosamente');
    await checkTurnoActivo();
    
  } catch (error) {
    console.error('Error abriendo turno:', error);
    showToast(error.message || 'Error al abrir turno', 'error');
  }
}

async function cerrarTurno() {
  if (!currentTurno) {
    showToast('No hay turno activo para cerrar', 'error');
    return;
  }
  
  const montoFinal = prompt(
    `Monto final en caja para el turno #${currentTurno.id}\n` +
    `Ventas registradas: ${formatCurrency(currentTurno.ventas_total || 0)}\n` +
    `Caja inicial: ${formatCurrency(currentTurno.monto_inicial)}\n` +
    `Total esperado: ${formatCurrency((currentTurno.ventas_total || 0) + currentTurno.monto_inicial)}\n\n` +
    'Monto final (CUP):', 
    String((currentTurno.ventas_total || 0) + currentTurno.monto_inicial)
  );
  
  if (montoFinal === null) return;
  
  const monto = parseFloat(montoFinal) || 0;
  
  try {
    const response = await apiFetch(`/turnos/${currentTurno.id}/cerrar`, {
      method: 'POST',
      body: JSON.stringify({ monto_final: monto })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Error al cerrar turno');
    }
    
    const diferencia = monto - ((currentTurno.ventas_total || 0) + currentTurno.monto_inicial);
    
    let mensaje = 'Turno cerrado exitosamente\n';
    if (diferencia !== 0) {
      mensaje += diferencia > 0 
        ? `✅ Sobrante: ${formatCurrency(diferencia)}`
        : `⚠️ Faltante: ${formatCurrency(Math.abs(diferencia))}`;
    }
    
    alert(mensaje);
    showToast('Turno cerrado correctamente');
    
    await checkTurnoActivo();
    await loadTurnosHistorial();
    
  } catch (error) {
    console.error('Error cerrando turno:', error);
    showToast(error.message || 'Error al cerrar turno', 'error');
  }
}

async function loadTurnosHistorial() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const esAdmin = ['admin', 'dueño'].includes(user.rol);
    
    const url = esAdmin 
      ? '/turnos?limit=50'
      : `/turnos?vendedor_id=${user.id}&limit=50`;
    
    const response = await apiFetch(url);
    const data = await response.json();
    
    const turnos = data.turnos || data;
    const tbody = $('#turnos-table-body');
    
    if (!tbody) return;
    
    if (turnos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No hay turnos registrados</td></tr>';
      return;
    }
    
    tbody.innerHTML = turnos.map(t => {
      const esperado = (t.ventas_total || 0) + t.monto_inicial;
      const diferencia = (t.monto_final || 0) - esperado;
      const diffClass = diferencia === 0 ? '' : (diferencia > 0 ? 'color: var(--success)' : 'color: var(--danger)');
      
      return `
        <tr>
          <td>${formatDate(t.fecha_apertura)}</td>
          <td>${t.vendedor_nombre || '-'}</td>
          <td>${t.pv_nombre || '-'}</td>
          <td>${formatCurrency(t.monto_inicial)}</td>
          <td>${formatCurrency(t.ventas_total || 0)}</td>
          <td>${formatCurrency(t.monto_final || 0)}</td>
          <td style="${diffClass}">${diferencia !== 0 ? formatCurrency(diferencia) : '✓'}</td>
          <td>
            <span style="padding: 0.25rem 0.5rem; border-radius: 4px; background: ${t.estado === 'cerrado' ? '#DCFCE7' : '#FEF3C7'}; color: ${t.estado === 'cerrado' ? '#166534' : '#92400E'}; font-size: 0.75rem; font-weight: 600;">
              ${t.estado}
            </span>
          </td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error cargando historial de turnos:', error);
  }
}
