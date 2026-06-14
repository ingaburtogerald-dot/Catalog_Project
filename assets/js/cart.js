/* ============================================================
   GYRO STORE — Carrito compartido (window.GyroCart)
   Usado por el catálogo (catalog.js) y el detalle (producto.js).
   Items guardan un "snapshot" {id,name,price,img,variant,qty} para
   poder renderizar el carrito en cualquier página. El total OFICIAL
   lo recalcula el servidor al crear el pedido.
   ============================================================ */
window.GyroCart = (function () {
  'use strict';

  const API = '/api';
  const CART_KEY = 'gyro_cart';
  let CONFIG = { currency: 'C$', whatsapp: '50585944758', volume: { minQty: 3, percent: 10 }, oneDriveSharingUrl: '' };

  window.resolveImageUrl = function (path) {
    const url = CONFIG.oneDriveSharingUrl;
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


  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `${CONFIG.currency}${Number(n).toFixed(2)}`;
  const $ = (sel) => document.querySelector(sel);
  const keyOf = (id, variant) => `${id}|${variant || ''}`;

  /* ---------- estado ---------- */
  let cart = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((it) => it && it.id)
        .map((it) => ({
          id: String(it.id),
          name: String(it.name || 'Producto'),
          price: Number(it.price) || 0,
          img: String(it.img || ''),
          variant: String(it.variant || ''),
          qty: Math.max(1, parseInt(it.qty, 10) || 1),
        }));
    } catch { return []; }
  }
  const save = () => localStorage.setItem(CART_KEY, JSON.stringify(cart));

  function computeTotals() {
    let subtotal = 0, discount = 0;
    cart.forEach((it) => {
      const line = it.price * it.qty;
      subtotal += line;
      if (it.qty >= CONFIG.volume.minQty) discount += line * (CONFIG.volume.percent / 100);
    });
    return { subtotal, discount, total: subtotal - discount };
  }

  /* ---------- render ---------- */
  function renderCart() {
    const body = $('#cart-body');
    if (!body) return;
    const { discount, total } = computeTotals();

    if (cart.length === 0) {
      body.innerHTML = `<p class="cart-empty">Tu carrito está vacío 🛒<br>Agregá productos del catálogo.</p>`;
    } else {
      body.innerHTML = cart.map((it) => {
        const k = keyOf(it.id, it.variant);
        return `
        <div class="cart-item">
          <img src="${esc(window.resolveImageUrl(it.img))}" alt="${esc(it.name)}">
          <div>
            <p class="cart-item-name">${esc(it.name)}</p>
            ${it.variant ? `<p class="cart-item-variant">${esc(it.variant)}</p>` : ''}
            <p class="cart-item-price">${money(it.price)}</p>
            <div class="qty">
              <button data-cdec="${esc(k)}" aria-label="Quitar uno">−</button>
              <span>${it.qty}</span>
              <button data-cinc="${esc(k)}" aria-label="Agregar uno">+</button>
            </div>
          </div>
          <button class="cart-remove" data-crem="${esc(k)}" aria-label="Eliminar ${esc(it.name)}">Quitar</button>
        </div>`;
      }).join('');
    }

    if ($('#discount-row')) $('#discount-row').hidden = discount <= 0;
    if ($('#cart-discount')) $('#cart-discount').textContent = `- ${money(discount)}`;
    if ($('#cart-total')) $('#cart-total').textContent = money(total);

    const count = cart.reduce((n, it) => n + it.qty, 0);
    const badge = $('#cart-badge');
    if (badge) { badge.textContent = count; badge.classList.toggle('show', count > 0); }
  }

  /* ---------- operaciones ---------- */
  function add(product, variant = '', qty = 1) {
    const k = keyOf(product.id, variant);
    const existing = cart.find((it) => keyOf(it.id, it.variant) === k);
    if (existing) existing.qty += qty;
    else cart.push({
      id: String(product.id),
      name: String(product.name || 'Producto'),
      price: Number(product.price) || 0,
      img: String(product.img || ''),
      variant: String(variant || ''),
      qty: Math.max(1, qty),
    });
    save(); renderCart(); bump();
    toast(`${product.name}${variant ? ` (${variant})` : ''} agregado al carrito`);
  }
  function changeQty(k, delta) {
    const it = cart.find((x) => keyOf(x.id, x.variant) === k);
    if (!it) return;
    it.qty += delta;
    if (it.qty <= 0) cart = cart.filter((x) => keyOf(x.id, x.variant) !== k);
    save(); renderCart();
  }
  function removeKey(k) {
    cart = cart.filter((x) => keyOf(x.id, x.variant) !== k);
    save(); renderCart();
  }

  /* ---------- checkout ---------- */
  async function submitCheckout(e) {
    e.preventDefault();
    const name = $('#co-name'), phone = $('#co-phone'), address = $('#co-address');
    const delivery = document.querySelector('input[name="delivery"]:checked').value;

    let ok = true;
    [name, phone].forEach((f) => { const bad = !f.value.trim(); f.classList.toggle('invalid', bad); if (bad) ok = false; });
    const needAddr = delivery === 'shipping' && !address.value.trim();
    address.classList.toggle('invalid', needAddr);
    if (needAddr) ok = false;
    if (!ok) { toast('Completá los campos obligatorios (*)'); return; }

    const customer = {
      name: name.value.trim(), phone: phone.value.trim(), delivery,
      address: address.value.trim(), note: $('#co-note').value.trim(),
    };

    const btn = $('#btn-confirm-order');
    btn.disabled = true;
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(({ id, qty, variant }) => ({ id, qty, variant })),
          customer,
        }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || 'Error al registrar el pedido');

      cart = []; save(); renderCart();
      $('#checkout-form').reset();
      closeCheckout(); closeCart();
      toast(`¡Pedido #${order.id.slice(0, 6)} enviado! Total ${money(order.total)}`);
      window.open(order.whatsappUrl, '_blank');
    } catch (err) {
      toast(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- UI helpers ---------- */
  const openCart = () => { $('#cart-overlay').hidden = false; $('#cart-drawer').classList.add('open'); $('#cart-drawer').setAttribute('aria-hidden', 'false'); };
  const closeCart = () => { $('#cart-overlay').hidden = true; $('#cart-drawer').classList.remove('open'); $('#cart-drawer').setAttribute('aria-hidden', 'true'); };

  function openCheckout() {
    if (cart.length === 0) { toast('Tu carrito está vacío'); return; }
    const { total } = computeTotals();
    $('#co-summary').innerHTML = `<span>Total a pagar</span><strong>${money(total)}</strong>`;
    closeCart();
    $('#checkout-overlay').hidden = false;
    $('#checkout-modal').hidden = false;
    $('#checkout-modal').setAttribute('aria-hidden', 'false');
    $('#co-name').focus();
  }
  function closeCheckout() {
    $('#checkout-overlay').hidden = true;
    $('#checkout-modal').hidden = true;
    $('#checkout-modal').setAttribute('aria-hidden', 'true');
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 300); }, 2400);
  }
  function bump() {
    const b = $('#cart-badge');
    if (!b) return;
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }

  /* ---------- init ---------- */
  function init() {
    if ($('#cart-fab')) $('#cart-fab').addEventListener('click', openCart);
    if ($('#btn-close-cart')) $('#btn-close-cart').addEventListener('click', closeCart);
    if ($('#cart-overlay')) $('#cart-overlay').addEventListener('click', closeCart);
    if ($('#btn-checkout')) $('#btn-checkout').addEventListener('click', openCheckout);
    if ($('#btn-close-checkout')) $('#btn-close-checkout').addEventListener('click', closeCheckout);
    if ($('#checkout-overlay')) $('#checkout-overlay').addEventListener('click', closeCheckout);
    if ($('#checkout-form')) $('#checkout-form').addEventListener('submit', submitCheckout);

    document.querySelectorAll('input[name="delivery"]').forEach((r) => {
      r.addEventListener('change', () => {
        const shipping = document.querySelector('input[name="delivery"]:checked').value === 'shipping';
        $('#co-address-wrap').hidden = !shipping;
      });
    });

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-cinc],[data-cdec],[data-crem]');
      if (!t) return;
      if (t.dataset.cinc) changeQty(t.dataset.cinc, +1);
      if (t.dataset.cdec) changeQty(t.dataset.cdec, -1);
      if (t.dataset.crem) removeKey(t.dataset.crem);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeCart(); closeCheckout(); } });

    renderCart();
  }

  return { setConfig: (cfg) => { CONFIG = cfg; }, add, init, toast, openCart };
})();
