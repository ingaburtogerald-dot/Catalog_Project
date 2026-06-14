// Configuración de OneDrive para alojamiento estático (ej: GitHub Pages)
// Si dejas este valor vacío, se usarán las imágenes locales en 'images_resources/'
window.ONEDRIVE_SHARING_URL = ''; 

window.resolveImageUrl = function (path) {
  const url = window.ONEDRIVE_SHARING_URL;
  if (!url || !path) return path;
  if (!path.includes('images_resources/')) return path;
  
  try {
    const base64 = btoa(url)
      .replace(/=/g, '')
      .replace(/\//g, '_')
      .replace(/\+/g, '-');
    const token = 'u!' + base64;
    const cleanPath = path.substring(path.indexOf('images_resources/') + 'images_resources/'.length);
    const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
    return `https://api.onedrive.com/v1.0/shares/${token}/root:/${encodedPath}:/content`;
  } catch (e) {
    console.error('Error resolving OneDrive image:', e);
    return path;
  }
};

window.rewriteStaticImages = function () {
  document.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.includes('images_resources/')) {
      img.src = window.resolveImageUrl(src);
    }
  });

  document.querySelectorAll('[style*="background-image"]').forEach(el => {
    const style = el.getAttribute('style');
    const match = style.match(/url\(['"]?([^'"]*images_resources[^'"]*)['"]?\)/);
    if (match) {
      const newUrl = window.resolveImageUrl(match[1]);
      el.style.backgroundImage = `url('${newUrl}')`;
    }
  });

  document.querySelectorAll('[data-img-placeholder], [data-image], [data-vimg]').forEach(el => {
    ['data-img-placeholder', 'data-image', 'data-vimg'].forEach(attr => {
      const val = el.getAttribute(attr);
      if (val && val.includes('images_resources/')) {
        el.setAttribute(attr, window.resolveImageUrl(val));
      }
    });
  });
};

// Intentar cargar la configuración de OneDrive desde el API local en desarrollo
(async () => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.oneDriveSharingUrl) {
        window.ONEDRIVE_SHARING_URL = cfg.oneDriveSharingUrl;
        if (typeof window.rewriteStaticImages === 'function') {
          window.rewriteStaticImages();
        }
      }
    }
  } catch (e) {}
})();

document.addEventListener('DOMContentLoaded', () => {
  // Reescribir todas las imágenes estáticas locales a OneDrive
  if (typeof window.rewriteStaticImages === 'function') {
    window.rewriteStaticImages();
  }

  // ============================================
  // MENÚ LATERAL (SIDEBAR DRAWER)
  // ============================================
  const openMenuBtn = document.getElementById('open-menu');
  const closeMenuBtn = document.getElementById('close-menu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');

  // Función para abrir el menú
  function openMenu() {
    if (sidebar && overlay) {
      sidebar.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Animación secuencial de entrada de los enlaces (Staggered animation)
      const menuItems = sidebar.querySelectorAll('.sidebar-nav ul li');
      menuItems.forEach((item, index) => {
        item.style.transitionDelay = `${(index + 1) * 0.06}s`;
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
      });
    }
  }

  // Función para cerrar el menú
  function closeMenu() {
    if (sidebar && overlay) {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';

      // Resetear la animación de los enlaces al salir
      const menuItems = sidebar.querySelectorAll('.sidebar-nav ul li');
      menuItems.forEach((item) => {
        item.style.transitionDelay = '0s';
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
      });
    }
  }

  // Event Listeners para abrir y cerrar
  if (openMenuBtn) openMenuBtn.addEventListener('click', openMenu);
  if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);

  // ============================================
  // FILTRADO DINÁMICO DE PRODUCTOS DESDE EL MENÚ LATERAL
  // ============================================
  const seccionTitulo = document.querySelector('.seccion-titulo');

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Si el enlace tiene un atributo data-filter
      const filter = link.getAttribute('data-filter');
      if (!filter) return; // Si no tiene filtro (ej: enlaces del footer), no hacemos nada

      // 1. Filtrar los productos visibles (buscados dinámicamente)
      const productos = document.querySelectorAll('.producto');
      let visibleCount = 0;
      productos.forEach(producto => {
        const categoria = producto.getAttribute('data-category');
        if (filter === 'todos' || categoria === filter) {
          producto.style.display = 'flex';
          visibleCount++;
        } else {
          producto.style.display = 'none';
        }
      });

      // 2. Mostrar/ocultar mensaje de categoría vacía
      const noProductsMessage = document.getElementById('no-products-message');
      if (noProductsMessage) {
        noProductsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
      }

      // 3. Cambiar dinámicamente el título de la sección
      if (seccionTitulo) {
        // Obtenemos el texto del enlace (removiendo el icono y espacios extras)
        const nombreCategoria = link.textContent.replace(/➔|➔/g, '').trim();

        if (filter === 'todos') {
          seccionTitulo.innerHTML = `<i class="fa-solid fa-fire"></i> Todos los productos en Gyro Store`;
        } else {
          seccionTitulo.innerHTML = `<i class="fa-solid fa-fire"></i> ${nombreCategoria}`;
        }
      }

      // 4. Cerrar el menú lateral
      closeMenu();
    });
  });

  // Cerrar con la tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      if (typeof window.closeCart === 'function') {
        window.closeCart();
      }
    }
  });

  // ============================================
  // INICIALIZACIÓN DEL CARRITO DE COMPRAS
  // ============================================
  const cartFloatBtn = document.getElementById('cart-float-btn');
  const closeCartBtn = document.getElementById('close-cart');
  const cartOverlay = document.getElementById('cart-overlay');
  const checkoutWhatsappBtn = document.getElementById('checkout-whatsapp');

  if (cartFloatBtn) cartFloatBtn.addEventListener('click', () => window.openCart());
  if (closeCartBtn) closeCartBtn.addEventListener('click', () => window.closeCart());
  if (cartOverlay) cartOverlay.addEventListener('click', () => window.closeCart());
  if (checkoutWhatsappBtn) checkoutWhatsappBtn.addEventListener('click', () => window.checkoutCart());

  // Delegación de eventos para botones "Agregar al Carrito" en tarjetas de catálogo
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-add-cart');
    if (btn) {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const price = parseFloat(btn.getAttribute('data-price')) || 0;
      const image = btn.getAttribute('data-image');

      // Obtener variantes por defecto
      let variants = {};
      const colorVal = btn.getAttribute('data-var-color');
      const conectorVal = btn.getAttribute('data-var-conector');
      const micVal = btn.getAttribute('data-var-mic');

      if (colorVal) variants['Color'] = colorVal;
      if (conectorVal) variants['Conector'] = conectorVal;
      if (micVal) variants['Micrófono'] = micVal;

      window.addToCart({
        id: id,
        name: name,
        price: price,
        image: image,
        variants: variants,
        quantity: 1
      });
    }
  });

  // Renderizar estado inicial
  if (typeof window.renderCart === 'function') {
    window.renderCart();
  }

  // Cargar productos del catálogo dinámico
  if (typeof window.cargarProductos === 'function') {
    window.cargarProductos();
  }
});

// ============================================
// FUNCIONES GLOBALES DEL CARRITO DE COMPRAS
// ============================================

window.openCart = function () {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (drawer && overlay) {
    drawer.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeCart = function () {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (drawer && overlay) {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.renderCart = function () {
  const cart = JSON.parse(localStorage.getItem('gyro_cart')) || [];
  const container = document.getElementById('cart-items-container');
  const badge = document.getElementById('cart-badge-count');
  const subtotalEl = document.getElementById('cart-subtotal');
  const discountRow = document.getElementById('cart-discount-row');
  const discountEl = document.getElementById('cart-discount');
  const totalEl = document.getElementById('cart-total');

  // Actualizar contador en la insignia flotante
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) badge.textContent = totalItems;

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <i class="fa-solid fa-cart-plus"></i>
        <p>Tu carrito está vacío</p>
        <button class="btn-continue-shopping" onclick="window.closeCart()">Ver productos</button>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = 'C$0.00';
    if (discountRow) discountRow.style.display = 'none';
    if (totalEl) totalEl.textContent = 'C$0.00';
    return;
  }

  let subtotal = 0;
  let totalDiscount = 0;
  let html = '';

  cart.forEach((item, index) => {
    let unitPrice = item.price;
    let basePrice = item.price;

    // Calcular escala de precios por volumen para KZ EDX Pro X
    if (item.id === 'kz-edx-pro-x') {
      basePrice = 430;
      const qty = item.quantity;
      if (qty >= 3 && qty <= 5) {
        unitPrice = 390;
      } else if (qty >= 6 && qty <= 11) {
        unitPrice = 370;
      } else if (qty >= 12) {
        unitPrice = 350;
      }
    } else if (item.id === 'kz-castor') {
      basePrice = item.price; // C$660 or C$700
      const qty = item.quantity;
      if (basePrice === 660) { // Harman Target
        if (qty >= 3 && qty <= 5) {
          unitPrice = 600;
        } else if (qty >= 6 && qty <= 11) {
          unitPrice = 560;
        } else if (qty >= 12) {
          unitPrice = 530;
        } else {
          unitPrice = 660;
        }
      } else { // Bass Improved (700)
        if (qty >= 3 && qty <= 5) {
          unitPrice = 640;
        } else if (qty >= 6 && qty <= 11) {
          unitPrice = 600;
        } else if (qty >= 12) {
          unitPrice = 570;
        } else {
          unitPrice = 700;
        }
      }
    } else if (item.id === 'kz-castor-pro') {
      basePrice = item.price; // C$550 (Harman) o C$590 (Bass)
      const qty = item.quantity;
      if (basePrice === 550) { // Harman Target
        if (qty >= 3 && qty <= 5) {
          unitPrice = 510;
        } else if (qty >= 6) {
          unitPrice = 490;
        } else {
          unitPrice = 550;
        }
      } else { // Bass Improved (590)
        if (qty >= 3 && qty <= 5) {
          unitPrice = 550;
        } else if (qty >= 6) {
          unitPrice = 530;
        } else {
          unitPrice = 590;
        }
      }
    } else if (item.id === 'kz-az09') {
      basePrice = 750;
      const qty = item.quantity;
      if (qty >= 3 && qty <= 5) {
        unitPrice = 700;
      } else if (qty >= 6) {
        unitPrice = 670;
      }
    } else if (item.id === 'attack-shark-x11') {
      basePrice = 1050;
      const qty = item.quantity;
      if (qty >= 3 && qty <= 5) {
        unitPrice = 990;
      } else if (qty >= 6) {
        unitPrice = 950;
      }
    }

    const itemSubtotal = basePrice * item.quantity;
    const itemTotal = unitPrice * item.quantity;
    const itemDiscount = itemSubtotal - itemTotal;

    subtotal += itemSubtotal;
    totalDiscount += itemDiscount;

    // Crear etiquetas para variantes
    const variantsStr = Object.entries(item.variants || {})
      .map(([key, val]) => `${key}: ${val}`)
      .join(' | ');

    // Corregir la ruta de la imagen en base al contexto de subdirectorios
    let imgPath = window.resolveImageUrl(item.image || '');
    if (!imgPath.startsWith('http')) {
      if (window.location.pathname.includes('/in-ear/') || window.location.pathname.includes('/computadoras/')) {
        imgPath = '../' + imgPath;
      }
    }

    // Enlace dinámico según el producto
    let detailLink = '#';
    if (item.id === 'kz-edx-pro-x') {
      detailLink = window.location.pathname.includes('/in-ear/') ? 'kz-edx-pro.html' : 'in-ear/kz-edx-pro.html';
    } else if (item.id === 'kz-castor') {
      detailLink = window.location.pathname.includes('/in-ear/') ? 'kz-castor.html' : 'in-ear/kz-castor.html';
    } else if (item.id === 'attack-shark-x11') {
      if (window.location.pathname.includes('/computadoras/')) {
        detailLink = 'attack-shark-x11.html';
      } else if (window.location.pathname.includes('/in-ear/')) {
        detailLink = '../computadoras/attack-shark-x11.html';
      } else {
        detailLink = 'computadoras/attack-shark-x11.html';
      }
    }

    html += `
      <div class="cart-item">
        <img class="cart-item-img" src="${imgPath}" alt="${item.name}">
        <div class="cart-item-details">
          <a href="${detailLink}" class="cart-item-title">${item.name}</a>
          ${variantsStr ? `<span class="cart-item-variants">${variantsStr}</span>` : ''}
          <span class="cart-item-price">C$${unitPrice.toFixed(2)} c/u</span>
          <div class="cart-item-actions">
            <div class="cart-item-qty">
              <button class="cart-qty-btn" onclick="window.updateCartQuantity(${index}, -1)" aria-label="Disminuir">-</button>
              <span class="cart-qty-val">${item.quantity}</span>
              <button class="cart-qty-btn" onclick="window.updateCartQuantity(${index}, 1)" aria-label="Aumentar">+</button>
            </div>
            <button class="btn-delete-item" onclick="window.removeFromCart(${index})" aria-label="Eliminar">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Actualizar resumen en la UI
  const finalTotal = subtotal - totalDiscount;
  if (subtotalEl) subtotalEl.textContent = `C$${subtotal.toFixed(2)}`;

  if (totalDiscount > 0) {
    if (discountRow) discountRow.style.display = 'flex';
    if (discountEl) discountEl.textContent = `-C$${totalDiscount.toFixed(2)}`;
  } else {
    if (discountRow) discountRow.style.display = 'none';
  }

  if (totalEl) totalEl.textContent = `C$${finalTotal.toFixed(2)}`;
};

window.addToCart = function (product) {
  let cart = JSON.parse(localStorage.getItem('gyro_cart')) || [];

  // Buscar duplicados con exactamente las mismas variantes seleccionadas
  const existingIndex = cart.findIndex(item => {
    if (item.id !== product.id) return false;
    const keys1 = Object.keys(item.variants || {});
    const keys2 = Object.keys(product.variants || {});
    if (keys1.length !== keys2.length) return false;
    return keys1.every(key => item.variants[key] === product.variants[key]);
  });

  if (existingIndex > -1) {
    cart[existingIndex].quantity += product.quantity || 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      variants: product.variants || {},
      quantity: product.quantity || 1
    });
  }

  localStorage.setItem('gyro_cart', JSON.stringify(cart));
  window.renderCart();
  window.openCart();

  // Efecto visual bump en el badge
  const badge = document.getElementById('cart-badge-count');
  if (badge) {
    badge.classList.add('bump');
    setTimeout(() => badge.classList.remove('bump'), 300);
  }
};

window.updateCartQuantity = function (index, change) {
  let cart = JSON.parse(localStorage.getItem('gyro_cart')) || [];
  if (cart[index]) {
    cart[index].quantity += change;
    if (cart[index].quantity < 1) {
      cart.splice(index, 1);
    }
    localStorage.setItem('gyro_cart', JSON.stringify(cart));
    window.renderCart();
  }
};

window.removeFromCart = function (index) {
  let cart = JSON.parse(localStorage.getItem('gyro_cart')) || [];
  cart.splice(index, 1);
  localStorage.setItem('gyro_cart', JSON.stringify(cart));
  window.renderCart();
};

window.checkoutCart = function () {
  const cart = JSON.parse(localStorage.getItem('gyro_cart')) || [];
  if (cart.length === 0) return;

  let mensaje = `¡Hola Gyro Store! Quisiera realizar el siguiente pedido:\n\n`;
  let subtotalGeneral = 0;
  let descuentoGeneral = 0;

  cart.forEach((item) => {
    let unitPrice = item.price;
    let basePrice = item.price;

    if (item.id === 'kz-edx-pro-x') {
      basePrice = 430;
      const qty = item.quantity;
      if (qty >= 3 && qty <= 5) {
        unitPrice = 390;
      } else if (qty >= 6 && qty <= 11) {
        unitPrice = 370;
      } else if (qty >= 12) {
        unitPrice = 350;
      }
    } else if (item.id === 'kz-castor') {
      basePrice = item.price; // C$660 o C$700
      const qty = item.quantity;
      if (basePrice === 660) { // Harman Target
        if (qty >= 3 && qty <= 5) {
          unitPrice = 600;
        } else if (qty >= 6 && qty <= 11) {
          unitPrice = 560;
        } else if (qty >= 12) {
          unitPrice = 530;
        } else {
          unitPrice = 660;
        }
      } else { // Bass Improved (700)
        if (qty >= 3 && qty <= 5) {
          unitPrice = 640;
        } else if (qty >= 6 && qty <= 11) {
          unitPrice = 600;
        } else if (qty >= 12) {
          unitPrice = 570;
        } else {
          unitPrice = 700;
        }
      }
    } else if (item.id === 'kz-castor-pro') {
      basePrice = item.price; // C$550 (Harman) o C$590 (Bass)
      const qty = item.quantity;
      if (basePrice === 550) { // Harman Target
        if (qty >= 3 && qty <= 5) {
          unitPrice = 510;
        } else if (qty >= 6) {
          unitPrice = 490;
        } else {
          unitPrice = 550;
        }
      } else { // Bass Improved (590)
        if (qty >= 3 && qty <= 5) {
          unitPrice = 550;
        } else if (qty >= 6) {
          unitPrice = 530;
        } else {
          unitPrice = 590;
        }
      }
    } else if (item.id === 'kz-az09') {
      basePrice = 750;
      const qty = item.quantity;
      if (qty >= 3 && qty <= 5) {
        unitPrice = 700;
      } else if (qty >= 6) {
        unitPrice = 670;
      }
    } else if (item.id === 'attack-shark-x11') {
      basePrice = 1050;
      const qty = item.quantity;
      if (qty >= 3 && qty <= 5) {
        unitPrice = 990;
      } else if (qty >= 6) {
        unitPrice = 950;
      }
    }

    const itemTotal = unitPrice * item.quantity;
    const itemSubtotal = basePrice * item.quantity;
    subtotalGeneral += itemSubtotal;
    descuentoGeneral += (itemSubtotal - itemTotal);

    const vars = Object.entries(item.variants || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    mensaje += `📦 *${item.name}* ${vars ? `(${vars})` : ''}\n`;
    mensaje += `   · Cantidad: ${item.quantity}\n`;
    mensaje += `   · Precio: C$${unitPrice.toFixed(2)} c/u\n`;
    mensaje += `   · Subtotal: C$${itemTotal.toFixed(2)}\n\n`;
  });

  const totalGeneral = subtotalGeneral - descuentoGeneral;
  mensaje += `---------------------------------\n`;
  mensaje += `💰 *Subtotal:* C$${subtotalGeneral.toFixed(2)}\n`;
  if (descuentoGeneral > 0) {
    mensaje += `🏷️ *Descuento / Ahorro:* -C$${descuentoGeneral.toFixed(2)}\n`;
  }
  mensaje += `💵 *TOTAL A PAGAR:* C$${totalGeneral.toFixed(2)}\n\n`;
  mensaje += `Por favor, confírmame disponibilidad para coordinar la entrega.`;

  const url = `https://wa.me/50585944758?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
};


// ============================================
// FUNCIONES DE CARGA DINÁMICA DE PRODUCTOS (JSON)
// ============================================

window.cargarProductos = async function () {
  const container = document.querySelector('.catalogo');
  if (!container) return;

  try {
    // Determinar la ruta relativa correcta de productos.json según la página
    let jsonPath = 'productos.json';
    if (window.location.pathname.includes('/in-ear/') || window.location.pathname.includes('/computadoras/')) {
      jsonPath = '../productos.json';
    }

    const response = await fetch(jsonPath);
    if (!response.ok) throw new Error('No se pudo cargar productos.json');
    const productos = await response.json();

    // Guardar en variable global por si se necesita en otro lado
    window.productosCatalogData = productos;

    // Determinar la página actual y filtrar la categoría correspondiente
    const pageName = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
    
    let defaultCategory = 'todos';
    if (pageName === 'in-ear.html') {
      defaultCategory = 'in-ear';
    } else if (pageName === 'accesorios-computadoras.html') {
      defaultCategory = 'computadoras';
    }

    window.renderizarCatalogo(productos, defaultCategory);
  } catch (error) {
    console.error('Error cargando el catálogo:', error);
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #ef4444;">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 36px; margin-bottom: 12px;"></i>
        <p style="font-weight: 500;">Hubo un problema al cargar los productos del catálogo.</p>
      </div>
    `;
  }
};

window.renderizarCatalogo = function (productos, categoriaFiltro) {
  const container = document.querySelector('.catalogo');
  if (!container) return;

  // Filtrar productos
  const productosFiltrados = productos.filter(p => categoriaFiltro === 'todos' || p.category === categoriaFiltro);

  let html = '';
  productosFiltrados.forEach(p => {
    // Determinar origen para el query string '?from=...'
    const pageName = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
    const fromParam = pageName.replace('.html', '');

    // Corregir la ruta de la imagen en base a la ubicación
    let imgPath = window.resolveImageUrl(p.image || p.img || '');
    if (!imgPath.startsWith('http') && (window.location.pathname.includes('/in-ear/') || window.location.pathname.includes('/computadoras/'))) {
      imgPath = '../' + imgPath;
    }

    // Corregir la ruta de detalle en base a la ubicación
    let detailUrl = p.detailUrl;
    if (detailUrl && (window.location.pathname.includes('/in-ear/') || window.location.pathname.includes('/computadoras/'))) {
      detailUrl = '../' + detailUrl;
    }

    // Crear el HTML de la tarjeta
    html += `
      <div class="producto" data-category="${p.category}">
        ${p.detailUrl ? `
          <a href="${detailUrl}?from=${fromParam}" class="producto-link">
            <img src="${imgPath}" alt="${p.name}">
          </a>
          <div class="producto-info">
            <h2><a href="${detailUrl}?from=${fromParam}" class="producto-titulo-link">${p.name}</a></h2>
            <p>${p.description}</p>
            <div class="precio">${p.priceDisplay}</div>
            <a class="btn-details" href="${detailUrl}?from=${fromParam}">
              <i class="fa-solid fa-circle-info"></i> Ver Detalles
            </a>
          </div>
        ` : `
          <img src="${imgPath}" alt="${p.name}">
          <div class="producto-info">
            <h2>${p.name}</h2>
            <p>${p.description}</p>
            <div class="precio">${p.priceDisplay}</div>
            <button class="btn-add-cart" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-image="${p.image || p.img || ''}">
              <i class="fa-solid fa-cart-plus"></i> Agregar al Carrito
            </button>
          </div>
        `}
      </div>
    `;
  });

  // Re-inyectar no-products-message
  html += `
    <div class="no-products-message" id="no-products-message" style="display: none; grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #64748b;">
      <i class="fa-regular fa-folder-open" style="font-size: 36px; margin-bottom: 12px; display: block; color: #cbd5e1;"></i>
      <p style="font-weight: 500;">Próximamente más productos en esta categoría</p>
    </div>
  `;

  container.innerHTML = html;

  // Actualizar la visibilidad del no-products-message
  const noProductsMessage = document.getElementById('no-products-message');
  if (noProductsMessage) {
    noProductsMessage.style.display = productosFiltrados.length === 0 ? 'block' : 'none';
  }
};

