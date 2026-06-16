// Portal Gyro Logistics — vista cliente (sus propios paquetes) y vista admin (todos los clientes).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const byId = (id) => document.getElementById(id);
const loadingView = byId('loading-view');
const loginView = byId('login-view');
const panelView = byId('panel-view');
const toastEl = byId('toast');

let firebaseAuth = null;
let idToken = null;
let isAdminLike = false;
let currentUser = null;

const STATUS_FLOW = ['compra_china', 'recibido_china', 'recibido_nicaragua'];
const STATUS_LABELS = {
  compra_china: 'Compra realizada en China',
  recibido_china: 'Recibido en bodega China',
  recibido_nicaragua: 'Recibido en Nicaragua',
};

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let toastTimer = null;
function toast(msg, dur = 3500) {
  if (!msg) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

async function apiUpload(method, path, formData) {
  const headers = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(`/api${path}`, { method, headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function statusPill(status) {
  return `<span class="status-pill status-${status}">${STATUS_LABELS[status] || status}</span>`;
}

function timelineHtml(shipment) {
  const currentIdx = STATUS_FLOW.indexOf(shipment.status);
  return `<div class="timeline">${STATUS_FLOW.map((s, i) => {
    const done = i <= currentIdx;
    return `<div class="timeline-step ${done ? 'done' : ''}">
      <i class="fa-solid ${done ? 'fa-circle-check' : 'fa-circle'}"></i> ${STATUS_LABELS[s]}
    </div>`;
  }).join('')}</div>`;
}

// ── Vista cliente ───────────────────────────────────────────────────────────
async function loadCustomerView() {
  const grid = byId('customer-grid');
  grid.innerHTML = `<div class="empty-state"><div class="spinner" style="width:28px;height:28px"></div></div>`;
  try {
    const shipments = await api('GET', '/logistics/shipments');
    if (!shipments.length) {
      grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open" style="font-size:32px;display:block;margin-bottom:10px"></i>Aún no has agregado ninguna compra. Usa "+ Nueva revisión".</div>`;
      return;
    }
    grid.innerHTML = shipments.map((s) => `
      <div class="shipment-card">
        <div class="ship-num"><i class="fa-solid fa-barcode"></i> ${esc(s.shippingNumber)}</div>
        <div class="ship-date">Compra: ${esc(s.purchaseDate)}</div>
        ${statusPill(s.status)}
        ${s.photoUrl ? `<a href="${esc(s.photoUrl)}" target="_blank" rel="noopener"><img class="shipment-photo" src="${esc(s.photoUrl)}" alt="Foto del paquete"></a>` : ''}
        ${timelineHtml(s)}
        ${s.history?.length && s.history[s.history.length - 1].comment
          ? `<p style="font-size:12px;color:var(--text-soft);margin:0">"${esc(s.history[s.history.length - 1].comment)}"</p>` : ''}
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">⚠️ ${esc(err.message)}</div>`;
  }
}

// ── Vista admin ────────────────────────────────────────────────────────────
let advanceTargetId = null;

async function loadAdminView() {
  const tbody = byId('admin-tbody');
  tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="spinner" style="width:28px;height:28px"></div></div></td></tr>`;
  try {
    const shipments = await api('GET', '/logistics/shipments');
    if (!shipments.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No hay revisiones todavía.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = shipments.map((s) => {
      const isFinal = s.status === STATUS_FLOW[STATUS_FLOW.length - 1];
      return `<tr>
        <td><strong>${esc(s.customerDisplayName)}</strong><br><span style="color:var(--muted);font-size:12px">${esc(s.customerEmail)}</span></td>
        <td>${esc(s.purchaseDate)}</td>
        <td>${esc(s.shippingNumber)}</td>
        <td>${statusPill(s.status)}</td>
        <td>${s.photoUrl ? `<a href="${esc(s.photoUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-image"></i> Ver</a>` : '—'}</td>
        <td>${isFinal ? '' : `<button class="btn-ghost" data-action="advance" data-id="${s.id}" data-next="${STATUS_LABELS[STATUS_FLOW[STATUS_FLOW.indexOf(s.status) + 1]]}">Avanzar</button>`}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">⚠️ ${esc(err.message)}</div></td></tr>`;
  }
}

byId('admin-tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="advance"]');
  if (!btn) return;
  advanceTargetId = btn.dataset.id;
  byId('advance-modal-title').textContent = `Avanzar a: ${btn.dataset.next}`;
  byId('f-comment').value = '';
  byId('advance-modal').classList.remove('hidden');
});

byId('close-advance-modal').onclick = byId('cancel-advance').onclick = () => {
  byId('advance-modal').classList.add('hidden');
  advanceTargetId = null;
};

byId('advance-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!advanceTargetId) return;
  const comment = byId('f-comment').value.trim();
  const btn = byId('submit-advance');
  btn.disabled = true;
  try {
    await api('PATCH', `/logistics/shipments/${advanceTargetId}/advance`, { comment });
    toast('Estado actualizado. Se notificó al cliente por correo.');
    byId('advance-modal').classList.add('hidden');
    advanceTargetId = null;
    loadAdminView();
  } catch (err) {
    toast(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
});

// ── Crear revisión (cliente) ──────────────────────────────────────────────
byId('btn-new-shipment').onclick = () => {
  byId('create-form').reset();
  byId('create-modal').classList.remove('hidden');
};
byId('close-create-modal').onclick = byId('cancel-create').onclick = () => {
  byId('create-modal').classList.add('hidden');
};

byId('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = byId('submit-create');
  btn.disabled = true;
  try {
    const fd = new FormData();
    fd.append('purchaseDate', byId('f-purchaseDate').value);
    fd.append('shippingNumber', byId('f-shippingNumber').value.trim());
    const file = byId('f-photo').files[0];
    if (file) fd.append('photo', file);

    await apiUpload('POST', '/logistics/shipments', fd);
    toast('Revisión creada. Te avisaremos por correo cuando avance el estado.');
    byId('create-modal').classList.add('hidden');
    loadCustomerView();
  } catch (err) {
    toast(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
});

// Nota: a propósito NO se cierran los modales al hacer clic en el fondo (backdrop),
// para evitar perder lo que el usuario ya escribió por un clic accidental. Se cierran
// solo con los botones de Cancelar/Cerrar (X).

// ── Logout ─────────────────────────────────────────────────────────────────
byId('btn-logout').addEventListener('click', async () => {
  try { if (firebaseAuth) await signOut(firebaseAuth); } catch {}
  localStorage.removeItem('gyro_admin_logged_in');
  localStorage.removeItem('gyro_user_role');
  localStorage.removeItem('gyro_user_roles');
  localStorage.removeItem('gyro_user_name');
  localStorage.removeItem('gyro_user_photo');
  window.location.href = 'index.html';
});

// ── Bootstrap de autenticación ───────────────────────────────────────────
function showLogin(errorMsg) {
  loadingView.classList.add('hidden');
  loginView.classList.remove('hidden');
  panelView.classList.add('hidden');
  const el = byId('login-error');
  if (errorMsg) { el.textContent = errorMsg; el.classList.remove('hidden'); } else el.classList.add('hidden');
}

async function showPanel(user) {
  currentUser = user;
  idToken = user.idToken;
  isAdminLike = ['admin', 'global_admin', 'logistics_admin'].includes(user.role)
    || (user.roles || []).some((r) => ['admin', 'global_admin', 'logistics_admin'].includes(r));

  localStorage.setItem('gyro_admin_logged_in', 'true');
  localStorage.setItem('gyro_user_name', user.displayName || user.email.split('@')[0]);
  localStorage.setItem('gyro_user_photo', user.photoURL || '');
  localStorage.setItem('gyro_user_role', user.role || '');
  localStorage.setItem('gyro_user_roles', JSON.stringify(user.roles || (user.role ? [user.role] : [])));

  loadingView.classList.add('hidden');
  loginView.classList.add('hidden');
  panelView.classList.remove('hidden');
  byId('user-photo').src = user.photoURL || 'assets/img/Gyro_Store_logo.jpeg';
  byId('user-email').textContent = user.email;

  if (isAdminLike) {
    byId('btn-new-shipment').classList.add('hidden');
    byId('admin-view').classList.remove('hidden');
    byId('customer-view').classList.add('hidden');
    loadAdminView();
  } else {
    byId('btn-new-shipment').classList.remove('hidden');
    byId('customer-view').classList.remove('hidden');
    byId('admin-view').classList.add('hidden');
    loadCustomerView();
  }
}

async function initAuth() {
  const savedTheme = localStorage.getItem('gyro_admin_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);

  let cfg;
  try {
    const r = await fetch('/api/auth/config');
    cfg = await r.json();
  } catch {
    return showLogin('No se pudo conectar con el servidor.');
  }
  if (!cfg.configured) return showLogin('Firebase no configurado en el servidor.');

  const app = initializeApp(cfg);
  firebaseAuth = getAuth(app);

  onAuthStateChanged(firebaseAuth, async (user) => {
    if (!user) return showLogin();
    try {
      const token = await user.getIdToken();
      idToken = token;
      const me = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error(data.error || `Error ${r.status}`), { status: r.status });
          return data;
        });

      const allowed = ['admin', 'global_admin', 'logistics_admin', 'logistics_customer'];
      const hasAccess = allowed.includes(me.role) || (me.roles || []).some((r) => allowed.includes(r));
      if (!hasAccess) {
        await signOut(firebaseAuth);
        return showLogin('Esta cuenta no tiene acceso a Gyro Logistics.');
      }

      await showPanel({
        email: me.email, idToken: token, photoURL: user.photoURL,
        displayName: user.displayName || me.email.split('@')[0],
        role: me.role, roles: me.roles,
      });
    } catch (err) {
      await signOut(firebaseAuth).catch(() => {});
      showLogin(err.status === 403 ? 'Esta cuenta no tiene permisos autorizados.' : `Error de sesión: ${err.message}`);
    }
  });

  byId('email-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(firebaseAuth, byId('login-email').value.trim(), byId('login-password').value);
    } catch (err) {
      showLogin('Correo o contraseña incorrectos.');
    }
  });
}

initAuth();
