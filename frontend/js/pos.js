// Tu Merkadito - Punto de Venta (POS)

let cart = [];
let products = [];
let categories = [];

async function loadPOS() {
  try {
    // Verificar si hay turno activo
    await checkTurnoActivo();
    
    // Cargar productos
    const response = await apiFetch('/productos?search=');
    products = await response.json();
    
    renderProducts(products);
    renderCategories();
    
  } catch (error) {
    console.error('Error cargando POS:', error);
    showToast('Error al cargar productos', 'error');
  }
}

async function checkTurnoActivo() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    const response = await apiFetch(`/turnos/activo?vendedor_id=${user.id}`);
    currentTurno = await response.json();
    
    if (!currentTurno && ['vendedor'].includes(user.rol)) {
      // Mostrar mensaje para abrir turno
      if (confirm('No tienes un turno abierto. ¿Deseas abrir uno ahora?')) {
        await openTurno();
      }
    }
  } catch (error) {
    console.error('Error verificando turno:', error);
  }
}

async function openTurno() {
  try {
    const montoInicial = prompt('Monto inicial de caja (opcional):', '0') || '0';
    
    const response = await apiFetch('/turnos/abrir', {
      method: 'POST',
      body: JSON.stringify({ monto_inicial: parseFloat(montoInicial) })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentTurno = data.turno;
      showToast('Turno abierto exitosamente', 'success');
    } else {
      showToast(data.error, 'error');
    }
  } catch (error) {
    showToast('Error al abrir turno', 'error');
  }
}

function renderProducts(productos) {
  const container = $('#pos-products');
  
  if (productos.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">No se encontraron productos</p>';
    return;
  }
  
  container.innerHTML = productos.map(p => `
    <div class="product-card ${p.stock_actual === 0 ? 'out-of-stock' : p.stock_actual <= p.stock_minimo ? 'low-stock' : ''}" 
         data-id="${p.id}" 
         onclick="addToCart(${p.id})">
      <h4>${p.nombre}</h4>
      <div class="price">${formatCurrency(p.precio)}</div>
      <div class="stock">Stock: ${p.stock_actual} ${p.unidad}</div>
    </div>
  `).join('');
}

function renderCategories() {
  // Agrupar productos por categoría
  const cats = [...new Set(products.map(p => p.categoria_nombre).filter(Boolean))];
  categories = ['todos', ...cats];
  
  const container = $('#pos-categories');
  container.innerHTML = categories.map(cat => `
    <button class="category-btn ${cat === 'todos' ? 'active' : ''}" 
            data-categoria="${cat}"
            onclick="filterByCategory('${cat}')">
      ${cat.charAt(0).toUpperCase() + cat.slice(1)}
    </button>
  `).join('');
}

function filterByCategory(categoria) {
  $$('.category-btn').forEach(btn => btn.classList.remove('active'));
  $(`.category-btn[data-categoria="${categoria}"]`)?.classList.add('active');
  
  if (categoria === 'todos') {
    renderProducts(products);
  } else {
    const filtered = products.filter(p => p.categoria_nombre === categoria);
    renderProducts(filtered);
  }
}

// Búsqueda
$('#pos-search')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  
  const filtered = products.filter(p => 
    p.nombre.toLowerCase().includes(term) || 
    (p.codigo && p.codigo.toLowerCase().includes(term))
  );
  
  renderProducts(filtered);
});

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  
  if (!product || product.stock_actual <= 0) {
    showToast('Producto sin stock', 'error');
    return;
  }
  
  const existingItem = cart.find(item => item.producto_id === productId);
  
  if (existingItem) {
    if (existingItem.cantidad < product.stock_actual) {
      existingItem.cantidad++;
    } else {
      showToast('No hay más stock disponible', 'warning');
      return;
    }
  } else {
    cart.push({
      producto_id: productId,
      nombre: product.nombre,
      precio: product.precio,
      cantidad: 1,
      descuento: 0
    });
  }
  
  updateCartUI();
}

function updateCartUI() {
  const container = $('#cart-items');
  
  if (cart.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">Carrito vacío</p>';
  } else {
    container.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.nombre}</div>
          <div class="cart-item-price">${formatCurrency(item.precio)} c/u</div>
        </div>
        <div class="cart-item-controls">
          <button onclick="updateCartItem(${index}, -1)">-</button>
          <span>${item.cantidad}</span>
          <button onclick="updateCartItem(${index}, 1)">+</button>
        </div>
        <div style="font-weight: bold; min-width: 60px; text-align: right;">
          ${formatCurrency(item.cantidad * item.precio - item.descuento)}
        </div>
      </div>
    `).join('');
  }
  
  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  const discount = cart.reduce((sum, item) => sum + item.descuento, 0);
  const total = subtotal - discount;
  
  $('#cart-subtotal').textContent = formatCurrency(subtotal);
  $('#cart-discount').textContent = formatCurrency(discount);
  $('#cart-total').textContent = formatCurrency(total);
}

function updateCartItem(index, change) {
  const item = cart[index];
  const product = products.find(p => p.id === item.producto_id);
  
  if (change > 0 && item.cantidad >= product.stock_actual) {
    showToast('No hay más stock disponible', 'warning');
    return;
  }
  
  item.cantidad += change;
  
  if (item.cantidad <= 0) {
    cart.splice(index, 1);
  }
  
  updateCartUI();
}

$('#btn-clear-cart')?.addEventListener('click', () => {
  cart = [];
  updateCartUI();
});

// Checkout modal
$('#btn-checkout')?.addEventListener('click', () => {
  if (cart.length === 0) {
    showToast('El carrito está vacío', 'warning');
    return;
  }
  
  if (!currentTurno) {
    showToast('Debe abrir un turno antes de vender', 'warning');
    return;
  }
  
  const total = cart.reduce((sum, item) => sum + (item.cantidad * item.precio - item.descuento), 0);
  $('#checkout-total').textContent = formatCurrency(total);
  $('#modal-checkout').classList.add('active');
});

$$('.btn-close, .modal .btn-close')?.forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.modal').forEach(m => m.classList.remove('active'));
  });
});

// Manejar método de pago
$$('input[name="metodo_pago"]')?.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const efectivoGroup = $('#efectivo-group');
    if (e.target.value === 'transferencia') {
      efectivoGroup.style.display = 'none';
    } else {
      efectivoGroup.style.display = 'block';
    }
  });
});

// Calcular cambio
$('#efectivo-recibido')?.addEventListener('input', (e) => {
  const total = parseFloat(cart.reduce((sum, item) => sum + (item.cantidad * item.precio - item.descuento), 0));
  const recibido = parseFloat(e.target.value) || 0;
  const cambio = recibido - total;
  
  const display = $('#cambio-display');
  if (cambio >= 0) {
    display.textContent = `Cambio: ${formatCurrency(cambio)}`;
    display.style.color = 'var(--success-color)';
  } else {
    display.textContent = `Falta: ${formatCurrency(Math.abs(cambio))}`;
    display.style.color = 'var(--danger-color)';
  }
});

// Confirmar venta
$('#btn-confirm-sale')?.addEventListener('click', async () => {
  const total = cart.reduce((sum, item) => sum + (item.cantidad * item.precio - item.descuento), 0);
  const metodoPago = $$('input[name="metodo_pago"]:checked')?.[0]?.value || 'efectivo';
  const efectivoRecibido = parseFloat($('#efectivo-recibido')?.value) || 0;
  
  if ((metodoPago === 'efectivo' || metodoPago === 'mixto') && efectivoRecibido < total) {
    showToast('El efectivo recibido es menor que el total', 'error');
    return;
  }
  
  try {
    const ventaData = {
      turno_id: currentTurno?.id,
      punto_venta_id: currentTurno?.id ? null : (JSON.parse(localStorage.getItem('user')).punto_venta_id),
      metodo_pago: metodoPago,
      efectivo_recibido: efectivoRecibido,
      total: total,
      detalle: cart.map(item => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
        descuento: item.descuento
      }))
    };
    
    const response = await apiFetch('/ventas', {
      method: 'POST',
      body: JSON.stringify(ventaData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('¡Venta registrada exitosamente!', 'success');
      cart = [];
      updateCartUI();
      $('#modal-checkout').classList.remove('active');
      
      // Recargar productos para actualizar stock
      await loadPOS();
      
      // Imprimir ticket (opcional)
      printTicket(data.venta);
    } else {
      showToast(data.error, 'error');
    }
  } catch (error) {
    console.error('Error registrando venta:', error);
    showToast('Error al registrar venta', 'error');
  }
});

function printTicket(venta) {
  // Aquí iría la lógica de impresión
  // Por ahora solo mostramos un toast
  showToast('Ticket listo para imprimir', 'success');
}
