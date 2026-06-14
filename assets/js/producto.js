/* ============================================================
   GYRO STORE — Página de detalle de producto
   Galería + variantes (color) + especificaciones + carrito (GyroCart)
   ============================================================ */
'use strict';

const API = '/api';
let CONFIG = { currency: 'C$', whatsapp: '50585944758', categories: [] };
let CATEGORIES = [];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${CONFIG.currency}${Number(n).toFixed(2)}`;
const $ = (sel) => document.querySelector(sel);

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

function categoryName(id) {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? `${c.icon} ${c.name}` : id;
}
function placeholderImg(category) {
  const c = CATEGORIES.find((x) => x.id === category);
  const icon = c ? c.icon : '🛍️';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='460'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#f4f6ff'/><stop offset='1' stop-color='#e7ecff'/>
    </linearGradient></defs>
    <rect width='600' height='460' fill='url(#g)'/>
    <text x='300' y='250' font-size='170' text-anchor='middle' dominant-baseline='middle'>${icon}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ---------- estado ---------- */
const state = { product: null, images: [], variant: '', qty: 1 };

/* ---------- render ---------- */
function renderBreadcrumb(p) {
  $('#breadcrumb').innerHTML = `
    <a href="index.html">Inicio</a> <span>›</span>
    <a href="index.html?cat=${esc(p.category)}">${esc(categoryName(p.category))}</a> <span>›</span>
    <span class="current">${esc(p.name)}</span>`;
}

function renderDetail(p) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const galleryThumbs = state.images.map((src, i) => `
    <button class="thumb ${i === 0 ? 'active' : ''}" data-thumb="${esc(src)}" aria-label="Imagen ${i + 1}">
      <img src="${esc(window.resolveImageUrl(src))}" alt="${esc(p.name)} ${i + 1}" loading="lazy">
    </button>`).join('');

  const variantSwatches = variants.length ? `
    <div class="buy-block">
      <span class="buy-label">Color / variante ${variants.length > 1 ? '<em>(elegí una)</em>' : ''}</span>
      <div class="variants" id="variants">
        ${variants.map((v, i) => `
          <button class="variant ${i === 0 ? 'active' : ''}" data-variant="${esc(v.name)}" ${v.img ? `data-vimg="${esc(v.img)}"` : ''}>
            ${esc(v.name)}
          </button>`).join('')}
      </div>
    </div>` : '';

  $('#product-detail').innerHTML = `
    <div class="product-detail">
      <div class="gallery">
        <div class="gallery-main">
          <img id="main-image" src="${esc(window.resolveImageUrl(state.images[0]))}" alt="${esc(p.name)}">
        </div>
        ${state.images.length > 1 ? `<div class="gallery-thumbs">${galleryThumbs}</div>` : ''}
      </div>

      <div class="buybox">
        <span class="buy-cat">${esc(categoryName(p.category))}</span>
        <h1 class="buy-title">${esc(p.name)}</h1>
        <p class="buy-price">${money(p.price)} <span class="buy-price-note">precio desde</span></p>
        <p class="buy-desc">${esc(p.desc || '')}</p>

        ${variantSwatches}

        <div class="buy-block">
          <span class="buy-label">Cantidad</span>
          <div class="qty qty--lg" id="qty-control">
            <button data-q="-1" aria-label="Restar">−</button>
            <span id="qty-value">1</span>
            <button data-q="1" aria-label="Sumar">+</button>
          </div>
        </div>

        <div class="buy-actions">
          <button class="btn btn--add btn--lg" id="btn-add-detail">🛒 Agregar al carrito</button>
          <a class="btn btn--whatsapp btn--lg" id="btn-consult" target="_blank" rel="noopener">
            <span aria-hidden="true">🟢</span> Consultar
          </a>
        </div>
      </div>
    </div>`;

  // Info: descripción + especificaciones
  const specs = Array.isArray(p.specs) ? p.specs : [];
  $('#product-info').innerHTML = `
    <div class="info-grid">
      <div class="info-card">
        <h2 class="info-title">Descripción</h2>
        <p class="info-text">${esc(p.desc || 'Sin descripción.')}</p>
      </div>
      <div class="info-card">
        <h2 class="info-title">Especificaciones técnicas</h2>
        ${specs.length ? `<table class="specs">
          ${specs.map((s) => `<tr><th>${esc(s.label)}</th><td>${esc(s.value)}</td></tr>`).join('')}
        </table>` : '<p class="info-text">Próximamente.</p>'}
      </div>
    </div>`;

  wireDetail(p);
}

function renderRelated(all, current) {
  const rel = all.filter((x) => x.category === current.category && x.id !== current.id).slice(0, 4);
  if (!rel.length) { $('#related').innerHTML = ''; return; }
  $('#related').innerHTML = `
    <h2 class="section-title">También te puede interesar</h2>
    <div class="catalog-grid">
      ${rel.map((p) => {
        const img = (p.images && p.images[0]) || p.img || placeholderImg(p.category);
        return `
        <article class="card">
          <a class="card-link" href="producto.html?id=${encodeURIComponent(p.id)}">
            <div class="card-media">
              <span class="card-tag">${esc(p.category)}</span>
              <img src="${esc(window.resolveImageUrl(img))}" alt="${esc(p.name)}" loading="lazy" width="320" height="240">
            </div>
            <div class="card-body">
              <h3 class="card-title">${esc(p.name)}</h3>
              <p class="card-price">Desde ${money(p.price)}</p>
            </div>
          </a>
        </article>`;
      }).join('')}
    </div>`;
}

/* ---------- interacción del detalle ---------- */
function setMainImage(src) { const el = $('#main-image'); if (el) el.src = window.resolveImageUrl(src); }

function wireDetail(p) {
  // Galería
  document.querySelectorAll('[data-thumb]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.thumb').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      setMainImage(btn.dataset.thumb);
    });
  });

  // Variantes
  document.querySelectorAll('[data-variant]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.variant').forEach((v) => v.classList.remove('active'));
      btn.classList.add('active');
      state.variant = btn.dataset.variant;
      if (btn.dataset.vimg) setMainImage(btn.dataset.vimg);
    });
  });

  // Cantidad
  $('#qty-control').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    state.qty = Math.max(1, state.qty + Number(b.dataset.q));
    $('#qty-value').textContent = state.qty;
  });

  // Agregar al carrito
  $('#btn-add-detail').addEventListener('click', () => {
    window.GyroCart.add(
      { id: p.id, name: p.name, price: p.price, img: $('#main-image').src },
      state.variant, state.qty,
    );
  });

  // Consultar por WhatsApp
  const msg = `¡Hola Gyro Store! Me interesa el producto *${p.name}*${state.variant ? ` (${state.variant})` : ''}.`;
  $('#btn-consult').href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
}

/* ---------- sidebar ---------- */
function renderSidebar() {
  const isLoggedIn = localStorage.getItem('gyro_admin_logged_in') === 'true';
  const isSeller = localStorage.getItem('gyro_admin_dev_mode') === 'seller';
  const currentUrl = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
  const basePath = '';

  const menuHTML = [{ id: 'all', name: 'Todo el catálogo', icon: '🛍️' }, ...CATEGORIES]
    .map((c) => `<li><a href="index.html?cat=${esc(c.id)}">${c.icon} ${esc(c.name)}</a></li>`).join('');

  let adminMenu = '';
  if (isLoggedIn) {
    const portalPage = isSeller ? 'vendedor.html' : 'admin.html';
    const portalName = isSeller ? 'Portal Vendedor' : 'Panel Admin';
    adminMenu = `<li><a href="${basePath}${portalPage}"><i class="fa-solid fa-lock-open" style="margin-right: 8px;"></i> ${portalName}</a></li>
      <li><a href="${basePath}${portalPage}?logout=true&from=${currentUrl}" style="color: var(--danger, #ef4444) !important;"><i class="fa-solid fa-right-from-bracket" style="margin-right: 8px;"></i> Cerrar Sesión</a></li>`;
  } else {
    adminMenu = `<li><a href="${basePath}admin.html?from=${currentUrl}"><i class="fa-solid fa-lock" style="margin-right: 8px;"></i> Iniciar Sesión</a></li>`;
  }

  $('#sidebar-menu').innerHTML = menuHTML + adminMenu;
}
const openMenu = () => { $('#sidebar-overlay').hidden = false; $('#sidebar').classList.add('open'); $('#btn-menu').setAttribute('aria-expanded', 'true'); };
const closeMenu = () => { $('#sidebar-overlay').hidden = true; $('#sidebar').classList.remove('open'); $('#btn-menu').setAttribute('aria-expanded', 'false'); };

/* ---------- init ---------- */
async function init() {
  $('#year').textContent = new Date().getFullYear();
  $('#btn-menu').addEventListener('click', openMenu);
  $('#btn-close-menu').addEventListener('click', closeMenu);
  $('#sidebar-overlay').addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  const id = new URLSearchParams(location.search).get('id');
  try {
    const cfg = await fetchJSON(`${API}/config`);
    CONFIG = cfg; CATEGORIES = cfg.categories || [];
    window.GyroCart.setConfig(cfg); window.GyroCart.init();
    renderSidebar();

    if (!id) throw new Error('Falta el identificador del producto.');
    const product = await fetchJSON(`${API}/products/${encodeURIComponent(id)}`);
    state.product = product;
    state.images = (product.images && product.images.length) ? product.images : [product.img || placeholderImg(product.category)];
    state.variant = (product.variants && product.variants[0]) ? product.variants[0].name : '';
    document.title = `${product.name} · Gyro Store`;

    renderBreadcrumb(product);
    renderDetail(product);

    const all = await fetchJSON(`${API}/products`);
    renderRelated(all, product);
  } catch (err) {
    $('#product-detail').innerHTML =
      `<div class="empty-state"><span class="empty-icon">😕</span>
       No se pudo cargar el producto.<br><small>${esc(err.message)}</small><br>
       <a class="btn btn--outline" href="index.html" style="margin-top:16px">← Volver al catálogo</a></div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
