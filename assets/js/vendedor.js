/* ============================================================
   GYRO STORE — Portal de Vendedores
   Permite visualizar el catálogo y gestionar pedidos.
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const API = '/api';
let CONFIG = { currency: 'C$', categories: [] };
let auth = null;
let currentUserInfo = null;
let catalogProducts = [];

/* ---------- utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${CONFIG.currency}${Number(n).toFixed(2)}`;
const $ = (s, c = document) => c.querySelector(s);

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const urlParams = new URLSearchParams(window.location.search);
  const isDevMode = urlParams.get('dev') === 'true' || urlParams.get('dev') === 'seller' || localStorage.getItem('gyro_admin_dev_mode') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'seller';
  if (isDevMode) {
    headers.Authorization = 'Bearer dev-seller-token';
  } else if (auth && auth.currentUser) {
    headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 300); }, 2600);
}

/* ============================================================
   Productos (Solo Lectura)
   ============================================================ */
async function loadProducts() {
  try {
    const products = await api('/products');
    catalogProducts = products;
    $('#product-count').textContent = products.length;
    $('#products-tbody').innerHTML = products.map((p) => `
      <tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td><span class="status-pill status-delivered" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: none;">Stock: ${p.stock || 0}</span></td>
        <td><strong>${money(p.price)}</strong></td>
      </tr>`).join('') || '<tr><td colspan="3" class="muted-note">No hay productos en el catálogo.</td></tr>';
  } catch (err) {
    toast(`Error al cargar catálogo: ${err.message}`);
  }
}

/* ============================================================
   Reportar Venta
   ============================================================ */
function calculateCommission(netProfit) {
  if (netProfit <= 0) return 0;
  if (netProfit <= 300) return netProfit * 0.45;
  if (netProfit <= 600) return netProfit * 0.40;
  if (netProfit <= 900) return netProfit * 0.38;
  if (netProfit <= 1000) return netProfit * 0.35;
  if (netProfit <= 1400) return netProfit * 0.32;
  if (netProfit <= 1800) return netProfit * 0.30;
  return netProfit * 0.28;
}

function updateReportEstimates() {
  const container = $('#report-items-container');
  let subtotal = 0;
  let estCommission = 0;
  
  container.querySelectorAll('.report-item-row').forEach(row => {
    const sel = row.querySelector('.product-select');
    const qtyInput = row.querySelector('.qty-input');
    const priceInput = row.querySelector('.price-input');
    
    if (sel.value && qtyInput.value && priceInput.value) {
      const p = catalogProducts.find(x => x.id === sel.value);
      const qty = parseInt(qtyInput.value) || 1;
      const sellPrice = parseFloat(priceInput.value) || 0;
      
      subtotal += sellPrice * qty;
      
      // Costo estimado: el 60% del precio sugerido (solo para UI)
      // La comisión real se calcula en el servidor con el costo real del lote.
      if (p) {
         const estimatedCost = (p.price || 0) * 0.6;
         const netProfit = (sellPrice - estimatedCost) * qty;
         estCommission += calculateCommission(netProfit);
      }
    }
  });

  $('#report-subtotal').textContent = `C$${subtotal.toFixed(2)}`;
  $('#report-commission').textContent = `~ C$${estCommission.toFixed(2)}`;
  $('#report-commission').title = "Estimación basada en costo promedio. El monto final es calculado por el administrador basado en el lote exacto de stock vendido.";
}

function addReportItemRow() {
  const container = $('#report-items-container');
  const div = document.createElement('div');
  div.className = 'report-item-row grid-form';
  div.style.gridTemplateColumns = '2fr 1fr 1fr auto';
  div.style.alignItems = 'end';
  
  const options = `<option value="">Seleccione producto...</option>` + 
    catalogProducts.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (Disp: ${p.stock || 0})</option>`).join('');

  div.innerHTML = `
    <label>Producto
      <select class="product-select" required>${options}</select>
    </label>
    <label>Cantidad
      <input type="number" class="qty-input" min="1" value="1" required>
    </label>
    <label>Vendido en (C$)
      <input type="number" class="price-input" min="0" step="0.01" required>
    </label>
    <button type="button" class="btn-ghost remove-item-btn" style="padding: 8px; color: #ef4444; border-color: transparent;">✖</button>
  `;
  
  div.querySelector('.product-select').addEventListener('change', (e) => {
    const p = catalogProducts.find(x => x.id === e.target.value);
    if (p) div.querySelector('.price-input').value = p.price;
    updateReportEstimates();
  });
  div.querySelector('.qty-input').addEventListener('input', updateReportEstimates);
  div.querySelector('.price-input').addEventListener('input', updateReportEstimates);
  div.querySelector('.remove-item-btn').addEventListener('click', () => {
    div.remove();
    updateReportEstimates();
  });
  
  container.appendChild(div);
}

function openReportModal() {
  if (catalogProducts.length === 0) loadProducts().then(() => openReportModal());
  else {
    $('#report-items-container').innerHTML = '';
    addReportItemRow();
    updateReportEstimates();
    $('#report-modal').classList.remove('hidden');
  }
}

function closeReportModal() {
  $('#report-modal').classList.add('hidden');
}

async function submitReport(e) {
  e.preventDefault();
  const btn = $('#submit-report-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  try {
    const items = [];
    $('#report-items-container').querySelectorAll('.report-item-row').forEach(row => {
      const id = row.querySelector('.product-select').value;
      const qty = parseInt(row.querySelector('.qty-input').value);
      const sellPrice = parseFloat(row.querySelector('.price-input').value);
      if (id && qty > 0) items.push({ id, qty, sellPrice });
    });

    if (items.length === 0) throw new Error("Debe añadir al menos un producto.");

    await api('/orders/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customer: { name: 'Venta Directa', phone: 'N/A', delivery: 'pickup' } })
    });

    toast('¡Venta reportada con éxito!', 'success');
    closeReportModal();
    loadOrders();
  } catch (err) {
    toast(`Error al reportar: ${err.message}`, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

/* ============================================================
   Pedidos (Lectura y Cambio de Estado)
   ============================================================ */
async function loadOrders() {
  try {
    const orders = await api('/orders');
    $('#orders-tbody').innerHTML = orders.map((o) => {
      const items = o.lines.map((l) => `${esc(l.name)}${l.variant ? ` (${esc(l.variant)})` : ''} x${l.qty}`).join(', ');
      const date = o.createdAt && o.createdAt._seconds
        ? new Date(o.createdAt._seconds * 1000).toLocaleString('es-NI') : '—';
      const c = o.customer || {};
      const deliv = c.delivery === 'shipping' ? `🚚 ${esc(c.address || '')}` : '🏬 Retiro en tienda';
      const cliente = c.name
        ? `<strong>${esc(c.name)}</strong><br><small>${esc(c.phone || '')}</small><br><small class="muted-note">${deliv}</small>${c.note ? `<br><small class="muted-note">📝 ${esc(c.note)}</small>` : ''}`
        : '<span class="muted-note">—</span>';
      const statuses = ['pending', 'paid', 'delivered', 'cancelled'];
      const select = `<select class="status-pill status-${esc(o.status)}" data-order="${esc(o.id)}">
        ${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>`;
      return `<tr>
        <td>#${esc(o.id.slice(0, 6))}</td>
        <td>${cliente}</td>
        <td>${items}</td>
        <td><strong>${money(o.total)}</strong></td>
        <td>${select}</td>
        <td>${date}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="muted-note">Aún no hay pedidos registrados.</td></tr>';
  } catch (err) { toast(`Error al cargar pedidos: ${err.message}`); }
}

async function updateOrderStatus(id, status) {
  try {
    await api(`/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    toast(`Pedido #${id.slice(0, 6)} → ${status}`);
    loadOrders();
  } catch (err) { toast(`Error: ${err.message}`); }
}

/* ============================================================
   Configuración / Temas
   ============================================================ */
function openSettingsModal() {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  $('#settings-theme').value = currentTheme;
  $('#settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  $('#settings-modal').classList.add('hidden');
}

function submitSettings(e) {
  e.preventDefault();
  const theme = $('#settings-theme').value;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('gyro_admin_theme', theme);
  toast('Configuración guardada.');
  closeSettingsModal();
}

function updateSelectStatusColor(selectEl) {
  if (!selectEl) return;
  selectEl.classList.remove('status-pending', 'status-paid', 'status-delivered', 'status-cancelled');
  const val = selectEl.value;
  selectEl.classList.add(`status-${val}`);
}

/* ============================================================
   Sesión / Vistas
   ============================================================ */
function redirectToLogin() {
  localStorage.removeItem('gyro_admin_logged_in');
  localStorage.removeItem('gyro_admin_dev_mode');
  const urlParams = new URLSearchParams(window.location.search);
  const fromParam = urlParams.get('from') || window.location.pathname + window.location.search;
  window.location.href = `admin.html?from=${encodeURIComponent(fromParam)}`;
}

async function showPanel(user) {
  currentUserInfo = user;
  localStorage.setItem('gyro_admin_logged_in', 'true');
  localStorage.setItem('gyro_user_name', user.displayName || user.email.split('@')[0] || '');
  localStorage.setItem('gyro_user_photo', user.photoURL || '');
  localStorage.setItem('gyro_user_role', user.role || '');

  // Si un admin entra por error a vendedor.html, lo redirigimos a admin.html
  if (user.role === 'admin') {
    localStorage.removeItem('gyro_admin_dev_mode');
    window.location.href = 'admin.html' + window.location.search;
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const fromPage = urlParams.get('from');
  if (fromPage) {
    window.location.href = fromPage;
    return;
  }

  const loadingView = $('#loading-view');
  if (loadingView) loadingView.classList.add('hidden');
  $('#panel-view').classList.remove('hidden');
  $('#user-email').textContent = user.email;
  $('#user-photo').src = user.photoURL || 'assets/img/Gyro_Store_logo.jpeg';

  CONFIG = await api('/config');
  await loadOrders();
}

/* ============================================================
   Init
   ============================================================ */
async function init() {
  // Cargar y aplicar tema guardado
  const savedTheme = localStorage.getItem('gyro_admin_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);

  // Listeners de UI
  const btnSettings = $('#btn-settings');
  if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
  $('#settings-form').addEventListener('submit', submitSettings);
  
  const btnReport = $('#btn-report-sale');
  if (btnReport) btnReport.addEventListener('click', openReportModal);
  
  $('#btn-add-report-item').addEventListener('click', addReportItemRow);
  $('#report-form').addEventListener('submit', submitReport);

  const modalCloseActions = [
    { btn: '#close-settings-modal-btn', action: closeSettingsModal },
    { btn: '#cancel-settings-btn', action: closeSettingsModal },
    { btn: '#close-report-modal-btn', action: closeReportModal },
    { btn: '#cancel-report-btn', action: closeReportModal }
  ];
  modalCloseActions.forEach(cfg => {
    const el = $(cfg.btn);
    if (el) el.addEventListener('click', cfg.action);
  });

  const btnLogout = $('#btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      closeSettingsModal();
      localStorage.removeItem('gyro_admin_logged_in');
      localStorage.removeItem('gyro_admin_dev_mode');
      const urlParams = new URLSearchParams(window.location.search);
      const isDevMode = urlParams.get('dev') === 'true' || urlParams.get('dev') === 'seller' || localStorage.getItem('gyro_admin_dev_mode') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'seller';
      if (isDevMode) {
        window.location.href = 'admin.html';
      } else if (auth) {
        signOut(auth).catch(() => {});
      } else {
        redirectToLogin();
      }
    });
  }

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      $('#tab-products').classList.toggle('hidden', target !== 'products');
      $('#tab-orders').classList.toggle('hidden', target !== 'orders');
      if (target === 'orders') loadOrders();
      if (target === 'products') loadProducts();
    });
  });

  document.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-order]');
    if (sel) {
      updateOrderStatus(sel.dataset.order, sel.value);
      updateSelectStatusColor(sel);
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const isDevMode = urlParams.get('dev') === 'true' || urlParams.get('dev') === 'seller' || localStorage.getItem('gyro_admin_dev_mode') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'seller';

  if (urlParams.get('logout') === 'true') {
    localStorage.removeItem('gyro_admin_logged_in');
    localStorage.removeItem('gyro_admin_dev_mode');
    const fromPage = urlParams.get('from') || 'index.html';
    window.location.href = fromPage;
    return;
  }

  if (isDevMode) {
    console.log('Dev mode active in Seller Portal. Bypassing Firebase Auth.');
    const isSeller = localStorage.getItem('gyro_admin_dev_mode') === 'seller' || urlParams.get('dev') === 'seller';
    if (!isSeller) {
      window.location.href = 'admin.html' + window.location.search;
      return;
    }
    await showPanel({
      email: 'dev-seller@gyrostore.com',
      photoURL: '../assets/img/Gyro_Store_logo.jpeg',
      displayName: 'Gerald Inga (Seller)',
      role: 'seller'
    });
    return;
  }

  // Configuración de Firebase Web
  let fbConfig;
  try {
    fbConfig = await api('/auth/config');
  } catch {
    return redirectToLogin();
  }
  if (!fbConfig.configured) {
    return redirectToLogin();
  }

  // Inicializa Firebase Auth
  const app = initializeApp(fbConfig);
  auth = getAuth(app);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return redirectToLogin();
    try {
      const me = await api('/auth/me');
      await showPanel({
        email: me.email,
        photoURL: user.photoURL,
        displayName: user.displayName || me.email.split('@')[0],
        role: me.role
      });
    } catch (err) {
      await signOut(auth);
      redirectToLogin();
    }
  });
}

init();
