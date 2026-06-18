// Tu Merkadito - Módulo POS

let cart = [];
let products = [];
let categorias = [];
let currentTurno = null;

document.addEventListener('DOMContentLoaded', () => {
  // Event listeners del POS
  $('#pos-search')?.addEventListener('input', filtrarProductos);
  $('#btn-clear-cart')?.addEventListener('click', clearCart);
  $('#btn-checkout')?.addEventListener('click', showCheckoutModal);
  
  // Modal checkout
  $$('.btn-close, .modal-footer .btn-secondary').forEach(btn => {
    btn.addEventListener('click', () => closeModal('modal-checkout'));
  });
  
  $('#efectivo-recibido')?.addEventListener('input', calcularCambio);
  $('#btn-confirm-sale')?.addEventListener('click', confirmarVenta);
  
  // Cerrar modal con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('modal-checkout');
    }
  });
});

async function loadPOS() {
  try {
    // Verificar turno activo
    await checkTurnoActivo();
    
    // Cargar productos
    const response = await apiFetch('/productos?activo=1');
    const data = await response.json();
    products = data.productos || data;
    
    // Extraer categorías únicas
    categorias = [...new Set(products.map(p => p.categoria).filter(Boolean))];
    renderCategorias();
    
    // Renderizar productos
    renderProductos(products);
    
  } catch (error) {
    console.error('Error cargando POS:', error);
    showToast('Error cargando productos', 'error');
  }
}

async function checkTurnoActivo() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const response = await apiFetch(`/turnos/activo?vendedor_id=${user.id}`);
    const data = await response.json();
    
    currentTurno = data.turno;
    
    const turnoInfo = $('#pos-turno-info');
    if (turnoInfo) {
      if (currentTurno) {
        turnoInfo.innerHTML = `
          <strong>✅ Turno Activo</strong><br>
          ${currentTurno.vendedor_nombre}<br>
          Caja inicial: ${formatCurrency(currentTurno.monto_inicial)}
        `;
      } else {
        turnoInfo.innerHTML = `
          <strong>⚠️ Sin Turno</strong><br>
          Debe abrir un turno para vender
        `;
      }
    }
    
    // Deshabilitar cobro si no hay turno
    const btnCheckout = $('#btn-checkout');
    if (btnCheckout) {
      btnCheckout.disabled = !currentTurno;
      if (!currentTurno) {
        btnCheckout.textContent = 'Abra turno primero';
      } else {
        btnCheckout.textContent = '💵 Cobrar';
      }
    }
    
  } catch (error) {
    console.error('Error verificando turno:', error);
  }
}

function renderCategorias() {
  const container = $('#pos-categories');
  if (!container) return;
  
  container.innerHTML = `
    <button class="category-btn active" data-categoria="todos" role="tab">Todos</button>
    ${categorias.map(cat => `
      <button class="category-btn" data-categoria="${cat}" role="tab">${cat}</button>
    `).join('')}
  `;
  
  // Event listeners para categorías
  container.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtrarPorCategoria(btn.dataset.categoria);
    });
  });
}

function renderProductos(lista) {
  const container = $('#pos-products');
  if (!container) return;
  
  if (lista.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">No se encontraron productos</p>';
    return;
  }
  
  container.innerHTML = lista.map(prod => {
    const sinStock = prod.stock_actual <= 0;
    const bajoStock = prod.stock_actual <= prod.stock_minimo && prod.stock_actual > 0;
    
    return `
      <div class="product-card ${sinStock ? 'out-of-stock' : ''} ${bajoStock ? 'low-stock' : ''}" 
           tabindex="0" 
           role="gridcell"
           aria-label="${prod.nombre}, precio ${formatCurrency(prod.precio)}, stock ${prod.stock_actual}"
           onclick="addToCart(${prod.id})"
           onkeypress="if(event.key==='Enter') addToCart(${prod.id})">
        <h4>${prod.nombre}</h4>
        <div class="price">${formatCurrency(prod.precio)}</div>
        <div class="stock">📦 Stock: ${prod.stock_actual} ${prod.unidad || 'ud'}</div>
      </div>
    `;
  }).join('');
}

function filtrarProductos(e) {
  const term = e.target.value.toLowerCase().trim();
  
  if (!term) {
    renderProductos(products);
    return;
  }
  
  const filtrados = products.filter(p => 
    p.nombre.toLowerCase().includes(term) ||
    (p.codigo && p.codigo.toLowerCase().includes(term))
  );
  
  renderProductos(filtrados);
}

function filtrarPorCategoria(categoria) {
  if (categoria === 'todos') {
    renderProductos(products);
  } else {
    const filtrados = products.filter(p => p.categoria === categoria);
    renderProductos(filtrados);
  }
}

function addToCart(productId) {
  const producto = products.find(p => p.id === productId);
  if (!producto || producto.stock_actual <= 0) {
    showToast('Producto sin stock', 'error');
    return;
  }
  
  const itemEnCarrito = cart.find(i => i.id === productId);
  
  if (itemEnCarrito) {
    if (itemEnCarrito.cantidad >= producto.stock_actual) {
      showToast('No hay más stock disponible', 'warning');
      return;
    }
    itemEnCarrito.cantidad++;
  } else {
    cart.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1,
      stock: producto.stock_actual
    });
  }
  
  renderCart();
  showToast(`"${producto.nombre}" agregado`);
}

function renderCart() {
  const container = $('#cart-items');
  if (!container) return;
  
  if (cart.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Carrito vacío</p>';
    updateTotals();
    return;
  }
  
  container.innerHTML = cart.map((item, index) => `
    <div class="cart-item" role="listitem">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nombre}</div>
        <div class="cart-item-price">${formatCurrency(item.precio)} c/u</div>
      </div>
      <div class="cart-item-controls">
        <button onclick="updateCartQty(${index}, -1)" aria-label="Reducir cantidad">−</button>
        <span aria-label="Cantidad">${item.cantidad}</span>
        <button onclick="updateCartQty(${index}, 1)" aria-label="Aumentar cantidad">+</button>
      </div>
      <div style="font-weight: 600; min-width: 70px; text-align: right;">
        ${formatCurrency(item.precio * item.cantidad)}
      </div>
    </div>
  `).join('');
  
  updateTotals();
}

function updateCartQty(index, delta) {
  const item = cart[index];
  if (!item) return;
  
  const producto = products.find(p => p.id === item.id);
  const nuevaCantidad = item.cantidad + delta;
  
  if (nuevaCantidad <= 0) {
    cart.splice(index, 1);
  } else if (nuevaCantidad > producto.stock_actual) {
    showToast('No hay más stock disponible', 'warning');
    return;
  } else {
    item.cantidad = nuevaCantidad;
  }
  
  renderCart();
}

function clearCart() {
  if (cart.length === 0) return;
  
  if (confirm('¿Vaciar carrito?')) {
    cart = [];
    renderCart();
  }
}

function updateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const descuento = 0; // Por ahora sin descuento
  const total = subtotal - descuento;
  
  $('#cart-subtotal').textContent = formatCurrency(subtotal);
  $('#cart-discount').textContent = formatCurrency(descuento);
  $('#cart-total').textContent = formatCurrency(total);
  
  // Actualizar modal
  $('#checkout-total-amount').textContent = formatCurrency(total);
}

function showCheckoutModal() {
  if (cart.length === 0) {
    showToast('El carrito está vacío', 'warning');
    return;
  }
  
  if (!currentTurno) {
    showToast('Debe abrir un turno para vender', 'error');
    showView('turnos');
    return;
  }
  
  openModal('modal-checkout');
  
  // Resetear formulario
  $('#checkout-form').reset();
  $('#cambio-display').textContent = '';
  $('#efectivo-recibido').value = '';
  
  // Foco en campo efectivo
  setTimeout(() => $('#efectivo-recibido')?.focus(), 100);
}

function calcularCambio() {
  const total = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const recibido = parseFloat($('#efectivo-recibido').value) || 0;
  const cambio = recibido - total;
  
  const display = $('#cambio-display');
  if (cambio >= 0) {
    display.textContent = `Cambio: ${formatCurrency(cambio)}`;
    display.style.color = 'var(--success)';
  } else {
    display.textContent = `Falta: ${formatCurrency(Math.abs(cambio))}`;
    display.style.color = 'var(--danger)';
  }
}

async function confirmarVenta() {
  const total = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const metodoPago = document.querySelector('input[name="metodo_pago"]:checked')?.value || 'efectivo';
  const efectivoRecibido = parseFloat($('#efectivo-recibido').value) || 0;
  
  // Validaciones
  if (metodoPago === 'efectivo' && efectivoRecibido < total) {
    showToast('El efectivo recibido es insuficiente', 'error');
    return;
  }
  
  const ventaData = {
    turno_id: currentTurno.id,
    detalle: cart.map(item => ({
      producto_id: item.id,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      descuento: 0
    })),
    metodo_pago: metodoPago,
    efectivo_recibido: metodoPago === 'efectivo' ? efectivoRecibido : total
  };
  
  try {
    const response = await apiFetch('/ventas', {
      method: 'POST',
      body: JSON.stringify(ventaData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Error al registrar venta');
    }
    
    // Éxito
    showToast('¡Venta registrada con éxito!', 'success');
    
    // Imprimir ticket (opcional)
    imprimirTicket(result.venta);
    
    // Limpiar carrito y cerrar modal
    cart = [];
    renderCart();
    closeModal('modal-checkout');
    
    // Recargar productos (actualizar stock)
    loadPOS();
    
  } catch (error) {
    console.error('Error registrando venta:', error);
    showToast(error.message || 'Error al registrar venta', 'error');
  }
}

function imprimirTicket(venta) {
  const ticketDiv = $('#ticket-print');
  if (!ticketDiv) return;
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const fecha = new Date().toLocaleString('es-CU');
  
  ticketDiv.innerHTML = `
    <div style="text-align: center;">
      <strong>TU MERKADITO</strong><br>
      Ticket #${venta.id}<br>
      ${fecha}<br>
      Vendedor: ${user.nombre}<br>
      ────────────────────
    </div>
    ${cart.map(item => `
      <div style="display: flex; justify-content: space-between; margin: 5px 0;">
        <span>${item.cantidad} x ${item.nombre.substring(0, 20)}</span>
        <span>${formatCurrency(item.precio * item.cantidad)}</span>
      </div>
    `).join('')}
    <div style="border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px;">
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
        <span>TOTAL:</span>
        <span>${formatCurrency(venta.total)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 5px;">
        <span>Pago:</span>
        <span>${venta.metodo_pago}</span>
      </div>
    </div>
    <div style="text-align: center; margin-top: 15px;">
      ¡Gracias por su compra!
    </div>
  `;
  
  // Imprimir
  window.print();
  
  // Limpiar después de imprimir
  setTimeout(() => ticketDiv.innerHTML = '', 1000);
}

// Utilidades de modal
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    
    // Foco trap para accesibilidad
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
}
