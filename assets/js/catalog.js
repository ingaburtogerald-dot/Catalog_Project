/* ============================================================
   GYRO STORE — Catálogo (página principal)
   Carga config + productos de la API y delega el carrito a GyroCart.
   ============================================================ */
'use strict';

const API = '/api';
let CONFIG = { currency: 'C$' };
let CATEGORIES = [{ id: 'all', name: 'Todo el catálogo', icon: '🛍️' }];
let PRODUCTS = [];
let activeCategory = 'all';
let searchTerm = '';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${CONFIG.currency}${Number(n).toFixed(2)}`;
const $ = (sel) => document.querySelector(sel);

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

function placeholderImg(product) {
  const cat = CATEGORIES.find((c) => c.id === product.category);
  const icon = cat ? cat.icon : '🛍️';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='240'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#f4f6ff'/><stop offset='1' stop-color='#e7ecff'/>
    </linearGradient></defs>
    <rect width='320' height='240' fill='url(#g)'/>
    <text x='160' y='130' font-size='90' text-anchor='middle' dominant-baseline='middle'>${icon}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const productImg = (p) => {
  const raw = (p.images && p.images[0]) || p.img || placeholderImg(p);
  return window.resolveImageUrl ? window.resolveImageUrl(raw) : raw;
};

/* ---------- filtros ---------- */
function getVisibleProducts() {
  const term = searchTerm.trim().toLowerCase();
  return PRODUCTS.filter((p) => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchTerm = !term || `${p.name} ${p.desc}`.toLowerCase().includes(term);
    return matchCat && matchTerm;
  });
}

function renderCategories() {
  $('#filters').innerHTML = CATEGORIES.map((c) => `
    <button class="chip ${c.id === activeCategory ? 'active' : ''}" data-cat="${esc(c.id)}">
      ${c.icon} ${esc(c.name)}
    </button>`).join('');
  $('#sidebar-menu').innerHTML = CATEGORIES.map((c) => `
    <li><a href="#catalogo" class="${c.id === activeCategory ? 'active' : ''}" data-cat="${esc(c.id)}">
      ${c.icon} ${esc(c.name)}
    </a></li>`).join('');
}

function renderCatalog() {
  const items = getVisibleProducts();
  $('#empty-state').hidden = items.length !== 0;
  $('#catalog-grid').innerHTML = items.map((p, i) => {
    const href = `producto.html?id=${encodeURIComponent(p.id)}`;
    const hasVariants = p.variants && p.variants.length > 1;
    return `
    <article class="card" style="animation-delay:${i * 0.05}s">
      <a class="card-link" href="${href}" aria-label="Ver ${esc(p.name)}">
        <div class="card-media">
          <span class="card-tag">${esc(p.category)}</span>
          <img src="${esc(productImg(p))}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="320" height="240">
        </div>
      </a>
      <div class="card-body">
        <a class="card-link" href="${href}"><h3 class="card-title">${esc(p.name)}</h3></a>
        <p class="card-desc">${esc(p.desc)}</p>
        ${hasVariants ? `<p class="card-variants">${p.variants.length} variantes disponibles</p>` : ''}
        <p class="card-price">Desde ${money(p.price)}</p>
        <div class="card-actions">
          <a class="btn btn--outline" href="${href}">Ver detalles</a>
          <button class="btn btn--add" data-add="${esc(p.id)}" aria-label="Agregar ${esc(p.name)}">🛒</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ---------- navegación lateral ---------- */
const openMenu = () => { 
  $('#sidebar-overlay').hidden = false; 
  $('#sidebar').classList.add('open'); 
  $('#sidebar').setAttribute('aria-hidden', 'false'); 
  $('#btn-menu').setAttribute('aria-expanded', 'true'); 
};
const closeMenu = () => { 
  $('#sidebar-overlay').hidden = true; 
  $('#sidebar').classList.remove('open'); 
  $('#sidebar').setAttribute('aria-hidden', 'true'); 
  $('#btn-menu').setAttribute('aria-expanded', 'false'); 
};

function setCategory(cat) {
  activeCategory = cat;
  searchTerm = '';
  $('#search').value = '';
  renderCategories();
  renderCatalog();

  // Actualizar el título de la sección en la cabecera del catálogo
  const titleTextEl = $('#seccion-titulo-texto');
  if (titleTextEl) {
    const active = CATEGORIES.find(c => c.id === cat);
    if (active && cat !== 'all') {
      titleTextEl.textContent = active.name;
    } else {
      titleTextEl.textContent = 'Todos los productos en Gyro Store';
    }
  }
}

/* ---------- init ---------- */
async function init() {
  $('#year').textContent = new Date().getFullYear();

  $('#btn-menu').addEventListener('click', openMenu);
  $('#btn-close-menu').addEventListener('click', closeMenu);
  $('#sidebar-overlay').addEventListener('click', closeMenu);
  $('#search').addEventListener('input', (e) => { searchTerm = e.target.value; renderCatalog(); });

  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const cat = e.target.closest('[data-cat]');
    if (add) {
      const p = PRODUCTS.find((x) => x.id === add.dataset.add);
      if (p) window.GyroCart.add({ id: p.id, name: p.name, price: p.price, img: productImg(p) }, '', 1);
    }
    if (cat) {
      e.preventDefault();
      setCategory(cat.dataset.cat);
      if ($('#sidebar').classList.contains('open')) closeMenu();
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  try {
    const [cfg, products] = await Promise.all([fetchJSON(`${API}/config`), fetchJSON(`${API}/products`)]);
    CONFIG = cfg;
    CATEGORIES = [{ id: 'all', name: 'Todo el catálogo', icon: '🛍️' }, ...cfg.categories];
    PRODUCTS = products;
    window.GyroCart.setConfig(cfg);
    window.GyroCart.init();

    // categoría inicial desde ?cat=
    const urlCat = new URLSearchParams(location.search).get('cat');
    if (urlCat && CATEGORIES.some((c) => c.id === urlCat)) {
      setCategory(urlCat);
    } else {
      renderCategories();
      renderCatalog();
    }
  } catch (err) {
    $('#catalog-grid').innerHTML =
      `<p class="empty-state">⚠️ No se pudo cargar el catálogo.<br><small>${esc(err.message)}</small></p>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
