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
    $('#product-count').textContent = products.length;
    $('#products-tbody').innerHTML = products.map((p) => `
      <tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.category)}</td>
        <td><strong>${money(p.price)}</strong></td>
      </tr>`).join('') || '<tr><td colspan="3" class="muted-note">No hay productos en el catálogo.</td></tr>';
  } catch (err) {
    toast(`Error al cargar catálogo: ${err.message}`);
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

  const modalCloseActions = [
    { btn: '#close-settings-modal-btn', action: closeSettingsModal },
    { btn: '#cancel-settings-btn', action: closeSettingsModal }
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
