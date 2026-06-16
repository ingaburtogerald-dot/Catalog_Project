// Gestión de Usuarios — panel completo
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── State ──────────────────────────────────────────────────────────────────
let firebaseAuth = null;
let idToken = null;
let currentUserEmail = null;
let allUsers = [];
let activeRoleFilter = 'all';
let searchTerm = '';

// ── Roles ──────────────────────────────────────────────────────────────────
const VALID_ROLES = ['global_admin', 'admin', 'seller', 'cashier', 'logistics_admin', 'logistics_customer'];
const ROLE_META = {
  global_admin:       ['role-global_admin', '🌐 Admin. Global'],
  admin:              ['role-admin',         '👑 Admin'],
  seller:             ['role-seller',        '🏪 Vendedor'],
  cashier:            ['role-cashier',       '💰 Cajero'],
  logistics_admin:    ['role-logistics_admin',    '📦 Admin. Logística'],
  logistics_customer: ['role-logistics_customer', '🚚 Cliente Logística'],
};

function getSelectedRoles(containerId) {
  return [...byId(containerId).querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);
}

function setSelectedRoles(containerId, roles) {
  byId(containerId).querySelectorAll('input[type="checkbox"]').forEach((el) => {
    el.checked = roles.includes(el.value);
    el.closest('.role-check').classList.toggle('checked', el.checked);
  });
}

document.querySelectorAll('.role-checks').forEach((group) => {
  group.addEventListener('change', (e) => {
    const input = e.target.closest('input[type="checkbox"]');
    if (!input) return;
    input.closest('.role-check').classList.toggle('checked', input.checked);
  });
});

// ── DOM helpers ────────────────────────────────────────────────────────────
const byId = id => document.getElementById(id);
const loadingView  = byId('loading-view');
const panelView    = byId('panel-view');
const userPhoto    = byId('user-photo');
const userEmailEl  = byId('user-email');
const userCountEl  = byId('user-count');
const usersTbody   = byId('users-tbody');
const trashTbody   = byId('trash-tbody');
const createModal  = byId('create-modal');
const passModal    = byId('pass-modal');
const editModal    = byId('edit-modal');
const toastEl      = byId('toast');

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, dur = 3500) {
  if (!msg) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

// ── API wrapper ────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── Formatters ─────────────────────────────────────────────────────────────
function fmtDate(val) {
  if (!val) return '—';
  const d = val?.toDate ? val.toDate() : new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rolePill(role) {
  const [cls, label] = ROLE_META[role] || ['role-admin', role ?? '—'];
  return `<span class="role-pill ${cls}">${label}</span>`;
}

function rolePills(roles) {
  const list = Array.isArray(roles) && roles.length ? roles : ['—'];
  return list.map(rolePill).join(' ');
}

function typePill(type) {
  return type === 'local'
    ? `<span class="type-pill type-local"><i class="fa-solid fa-building"></i> Local</span>`
    : `<span class="type-pill type-guest"><i class="fa-brands fa-google"></i> Invitado</span>`;
}

function avatarHtml(displayName, email) {
  const letter = (displayName || email || '?')[0].toUpperCase();
  return `<div class="user-avatar">${letter}</div>`;
}

// ── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    byId('tab-users').classList.toggle('hidden', which !== 'users');
    byId('tab-trash').classList.toggle('hidden', which !== 'trash');
    if (which === 'trash') loadTrash(); else loadUsers();
  });
});

// ── Active users ───────────────────────────────────────────────────────────
async function loadUsers() {
  usersTbody.innerHTML = spinnerRow(6);
  try {
    allUsers = await api('GET', '/users');
    renderStats(allUsers);
    renderUsersTable();
  } catch (err) {
    toast(`Error cargando usuarios: ${err.message}`);
    usersTbody.innerHTML = emptyRow(6, '⚠️', `Error: ${err.message}`);
  }
}

function renderStats(users) {
  const counts = { total: users.length };
  VALID_ROLES.forEach((r) => { counts[r] = users.filter((u) => (u.roles || []).includes(r)).length; });
  const cards = [
    ['total', 'Usuarios', counts.total],
    ['admin', 'Admins', counts.admin],
    ['seller', 'Vendedores', counts.seller],
    ['logistics_admin', 'Logística (admin)', counts.logistics_admin],
    ['logistics_customer', 'Clientes Logística', counts.logistics_customer],
  ];
  byId('stats-row').innerHTML = cards.map(([, label, value]) => `
    <div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>
  `).join('');
}

function renderRoleFilterChips() {
  const chips = [['all', 'Todos'], ...VALID_ROLES.map((r) => [r, ROLE_META[r][1]])];
  byId('role-filter-chips').innerHTML = chips.map(([key, label]) => `
    <button type="button" class="filter-chip ${activeRoleFilter === key ? 'active' : ''}" data-role-filter="${key}">${label}</button>
  `).join('');
}
renderRoleFilterChips();

byId('role-filter-chips').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-role-filter]');
  if (!btn) return;
  activeRoleFilter = btn.dataset.roleFilter;
  renderRoleFilterChips();
  renderUsersTable();
});

byId('search-users').addEventListener('input', (e) => {
  searchTerm = e.target.value.trim().toLowerCase();
  renderUsersTable();
});

function renderUsersTable() {
  let users = allUsers;
  if (activeRoleFilter !== 'all') {
    users = users.filter((u) => (u.roles || []).includes(activeRoleFilter));
  }
  if (searchTerm) {
    users = users.filter((u) =>
      (u.displayName || '').toLowerCase().includes(searchTerm) || (u.email || '').toLowerCase().includes(searchTerm));
  }

  userCountEl.textContent = users.length;
  if (!users.length) {
    usersTbody.innerHTML = emptyRow(6, '👥', allUsers.length ? 'Sin resultados para este filtro.' : 'No hay usuarios activos. Crea el primero.');
    return;
  }
  usersTbody.innerHTML = users.map(u => {
    const isSelf      = u.email === currentUserEmail;
    const isLegacy    = u.legacy === true;
    const isProtected = u.protected === true;

    const actionCell = () => {
      if (isProtected) {
        return `<span title="Administrador principal — protegido del sistema"
          style="font-size:13px;color:var(--muted);display:flex;align-items:center;gap:5px">
          <i class="fa-solid fa-shield-halved" style="color:#7c83ff"></i> Protegido
        </span>`;
      }

      const editBtn = `
        <button class="btn-ghost" title="Editar usuario"
          data-action="edit" data-id="${u.id}" data-name="${esc(u.displayName)}" data-roles='${esc(JSON.stringify(u.roles || []))}'>
          <i class="fa-solid fa-pen"></i>
        </button>
      `;

      if (isLegacy) {
        return `
          ${editBtn}
          <span title="Usuario legado — se guardará en base de datos al editar"
            style="font-size:12px;color:var(--muted);margin-left:5px">Legado</span>
        `;
      }

      return `
        ${editBtn}
        ${isSelf
          ? `<span style="font-size:12px;color:var(--muted);padding:0 4px">Tú</span>`
          : `<button class="btn-danger" title="Mover a papelera"
              data-action="delete" data-id="${u.id}" data-name="${esc(u.displayName)}">
              <i class="fa-solid fa-trash"></i>
            </button>`
        }`;
    };

    return `<tr>
      <td>
        <div class="avatar-cell">
          ${avatarHtml(u.displayName, u.email)}
          <div>
            <div style="font-weight:600;color:var(--heading-color)">
              ${esc(u.displayName || '—')}
              ${isProtected ? `<i class="fa-solid fa-shield-halved" title="Admin principal" style="color:#7c83ff;font-size:11px;margin-left:4px"></i>` : ''}
            </div>
            ${u.username ? `<div style="font-size:12px;color:var(--muted)">${esc(u.username)}@gyrostore.com</div>` : ''}
          </div>
        </div>
      </td>
      <td style="color:var(--text-soft);font-size:13px">${esc(u.email)}</td>
      <td>${rolePills(u.roles)}</td>
      <td>${typePill(u.type)}</td>
      <td style="color:var(--text-soft);font-size:13px">
        ${isLegacy ? `<span style="color:var(--muted);font-size:12px">legado</span>` : fmtDate(u.createdAt)}
      </td>
      <td><div class="action-row">${actionCell()}</div></td>
    </tr>`;
  }).join('');
}

// ── Trash ──────────────────────────────────────────────────────────────────
async function loadTrash() {
  trashTbody.innerHTML = spinnerRow(6);
  try {
    const items = await api('GET', '/users/trash');
    if (!items.length) {
      trashTbody.innerHTML = emptyRow(6, '🗑️', 'La papelera está vacía.');
      return;
    }
    trashTbody.innerHTML = items.map(u => {
      const d = u.daysLeft ?? 0;
      const dayCls = d > 14 ? 'days-ok' : d > 5 ? 'days-warn' : 'days-danger';
      return `<tr>
        <td>
          <div class="avatar-cell">
            ${avatarHtml(u.displayName, u.email)}
            <span style="font-weight:600;color:var(--heading-color)">${esc(u.displayName || '—')}</span>
          </div>
        </td>
        <td style="color:var(--text-soft);font-size:13px">${esc(u.email)}</td>
        <td>${rolePills(u.roles || (u.role ? [u.role] : []))}</td>
        <td style="color:var(--muted);font-size:13px">${esc(u.deletedBy || '—')}</td>
        <td><span class="days-badge ${dayCls}">${d} día${d !== 1 ? 's' : ''}</span></td>
        <td>
          <div class="action-row">
            <button class="btn-restore" data-action="restore" data-id="${u.id}" data-name="${esc(u.displayName)}">
              <i class="fa-solid fa-rotate-left"></i> Restaurar
            </button>
            <button class="btn-danger" data-action="perm-delete" data-id="${u.id}" data-name="${esc(u.displayName)}">
              <i class="fa-solid fa-trash-can"></i> Eliminar
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    toast(`Error cargando papelera: ${err.message}`);
    trashTbody.innerHTML = emptyRow(6, '⚠️', `Error: ${err.message}`);
  }
}

// ── Table action delegation ────────────────────────────────────────────────
document.querySelector('section#tab-users').addEventListener('click', handleUserAction);
document.querySelector('section#tab-trash').addEventListener('click', handleTrashAction);

function handleUserAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id, name, roles } = btn.dataset;
  if (action === 'edit')   openEditModal(id, name, JSON.parse(roles || '[]'));
  if (action === 'delete') confirmDelete(id, name);
}

function handleTrashAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id, name } = btn.dataset;
  if (action === 'restore')     confirmRestore(id, name);
  if (action === 'perm-delete') confirmPermDelete(id, name);
}

async function confirmDelete(id, name) {
  if (!confirm(`¿Mover a la papelera a "${name}"?\n\nPodrás restaurarlo dentro de 30 días.`)) return;
  try {
    await api('DELETE', `/users/${id}`);
    toast(`${name} movido a la papelera.`);
    loadUsers();
  } catch (err) { toast(err.message); }
}

async function confirmRestore(id, name) {
  if (!confirm(`¿Restaurar a "${name}"?`)) return;
  try {
    await api('POST', `/users/trash/${id}/restore`);
    toast(`${name} restaurado exitosamente.`);
    loadTrash();
  } catch (err) { toast(err.message); }
}

async function confirmPermDelete(id, name) {
  if (!confirm(`¿ELIMINAR PERMANENTEMENTE a "${name}"?\n\nEsta acción no se puede deshacer.`)) return;
  try {
    await api('DELETE', `/users/trash/${id}`);
    toast(`${name} eliminado definitivamente.`);
    loadTrash();
  } catch (err) { toast(err.message); }
}

// ── Edit modal ─────────────────────────────────────────────────────────────
let editTargetId = null;

function openEditModal(id, name, currentRoles) {
  editTargetId = id;
  byId('edit-modal-name').value = name;
  setSelectedRoles('edit-modal-roles', currentRoles || []);
  editModal.classList.remove('hidden');
}

byId('close-edit-modal').onclick = byId('cancel-edit-modal').onclick = () => {
  editModal.classList.add('hidden');
  editTargetId = null;
};

byId('edit-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!editTargetId) return;
  const displayName = byId('edit-modal-name').value.trim();
  const roles = getSelectedRoles('edit-modal-roles');
  if (!roles.length) { toast('Selecciona al menos un rol.'); return; }
  try {
    await api('PATCH', `/users/${editTargetId}`, { displayName, roles });
    toast('Usuario actualizado correctamente.');
    editModal.classList.add('hidden');
    editTargetId = null;
    loadUsers();
  } catch (err) { toast(err.message); }
};

// ── Create modal ───────────────────────────────────────────────────────────
let createType = 'local';

byId('btn-create').onclick = () => {
  resetCreateForm();
  createModal.classList.remove('hidden');
};

byId('close-create-modal').onclick = byId('cancel-create').onclick = () => {
  createModal.classList.add('hidden');
};

document.querySelectorAll('.type-toggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    createType = btn.dataset.type;
    document.querySelectorAll('.type-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const isLocal = createType === 'local';
    byId('field-username').classList.toggle('hidden', !isLocal);
    byId('field-email').classList.toggle('hidden', isLocal);
    byId('f-username').required = isLocal;
    byId('f-email').required = !isLocal;
    // Los usuarios locales (@gyrostore.com) no tienen un buzón real — no se les puede enviar invitación.
    byId('field-sendInvite').classList.toggle('hidden', isLocal);
  });
});

function resetCreateForm() {
  createType = 'local';
  document.querySelectorAll('.type-toggle button').forEach((b, i) =>
    b.classList.toggle('active', i === 0));
  byId('field-username').classList.remove('hidden');
  byId('field-email').classList.add('hidden');
  byId('field-sendInvite').classList.add('hidden');
  byId('f-displayName').value = '';
  byId('f-username').value = '';
  byId('f-email').value = '';
  setSelectedRoles('f-roles', []);
  byId('f-sendInvite').checked = true;
  byId('f-username').required = true;
  byId('f-email').required = false;
}

byId('create-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = byId('submit-create');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';

  const roles = getSelectedRoles('f-roles');
  if (!roles.length) {
    toast('Selecciona al menos un rol.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Crear Usuario';
    return;
  }

  const body = {
    type: createType,
    displayName: byId('f-displayName').value.trim(),
    roles,
    sendInvite: createType === 'local' ? false : byId('f-sendInvite').checked,
  };
  if (createType === 'local') body.username = byId('f-username').value.trim();
  else body.email = byId('f-email').value.trim().toLowerCase();

  try {
    const result = await api('POST', '/users', body);

    createModal.classList.add('hidden');
    loadUsers();

    if (createType === 'local' && result.tempPassword) {
      showPassModal(result.tempPassword, result.emailSent);
    } else {
      const msg = result.emailSent
        ? `Usuario invitado creado. Correo enviado a ${esc(result.email)}.`
        : `Usuario invitado creado. El correo de invitación no pudo enviarse.`;
      toast(msg, 5000);
    }
  } catch (err) {
    toast(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Crear Usuario';
  }
});

// ── Password reveal modal ──────────────────────────────────────────────────
function showPassModal(password, emailSent) {
  byId('pass-value').textContent = password;
  passModal.classList.remove('hidden');
  if (!emailSent) {
    toast('El correo de activación no pudo enviarse. Comparte la contraseña manualmente.', 5000);
  }
}

byId('btn-copy-pass').onclick = async () => {
  const pw = byId('pass-value').textContent;
  try {
    await navigator.clipboard.writeText(pw);
    toast('Contraseña copiada al portapapeles.');
  } catch {
    toast('No se pudo copiar automáticamente. Selecciónala con el ratón.');
  }
};

byId('close-pass-modal').onclick = byId('close-pass-done').onclick = () => {
  passModal.classList.add('hidden');
};

// Nota: a propósito NO se cierran los modales al hacer clic en el fondo (backdrop),
// para evitar perder lo que el usuario ya escribió por un clic accidental. Se cierran
// solo con los botones de Cancelar/Cerrar (X).


// ── Row helpers ────────────────────────────────────────────────────────────
function spinnerRow(cols) {
  return `<tr><td colspan="${cols}">
    <div class="empty-state"><div class="spinner" style="width:28px;height:28px;margin:0 auto"></div></div>
  </td></tr>`;
}

function emptyRow(cols, icon, msg) {
  return `<tr><td colspan="${cols}">
    <div class="empty-state"><div class="icon">${icon}</div>${msg}</div>
  </td></tr>`;
}

// ── Auth bootstrap ─────────────────────────────────────────────────────────
async function initAuth() {
  const savedTheme = localStorage.getItem('gyro_admin_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);

  // Dev mode está bloqueado por auth-global.js antes de que este módulo ejecute.
  // Siempre se requiere autenticación real con Firebase.

  let cfg;
  try {
    const r = await fetch('/api/auth/config');
    cfg = await r.json();
  } catch {
    showFatalError('No se pudo conectar con el servidor.');
    return;
  }

  if (!cfg.configured) {
    showFatalError('Firebase no configurado en el servidor.');
    return;
  }

  const fbApp = initializeApp(cfg);
  firebaseAuth = getAuth(fbApp);

  onAuthStateChanged(firebaseAuth, async user => {
    if (!user) {
      showLoginScreen();
      return;
    }

    try {
      idToken = await user.getIdToken();
      const me = await api('GET', '/auth/me');

      if (!['admin', 'global_admin'].includes(me.role)) {
        window.location.href = 'vendedor.html';
        return;
      }

      currentUserEmail = me.email;
      userPhoto.src = user.photoURL || 'assets/img/Gyro_Store_logo.jpeg';
      userEmailEl.textContent = me.email;

      localStorage.setItem('gyro_user_role', me.role);
      localStorage.setItem('gyro_user_roles', JSON.stringify(me.roles || [me.role]));
      localStorage.setItem('gyro_user_name', user.displayName || me.email);
      localStorage.setItem('gyro_user_photo', user.photoURL || '');

      loadingView.classList.add('hidden');
      panelView.classList.remove('hidden');
      loadUsers();
    } catch (err) {
      showFatalError(err.message);
    }
  });
}

function showLoginScreen() {
  loadingView.innerHTML = `
    <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px;font-family:'Outfit',sans-serif">
      <img src="assets/img/Gyro_Store_logo.jpeg"
        style="width:80px;height:80px;border-radius:50%;border:3px solid #7c83ff;object-fit:cover"/>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">Gestión de Usuarios</h1>
      <p style="color:#aab2cf;font-size:14px;margin:0">Solo administradores tienen acceso a este portal.</p>
      <button id="btn-google-login"
        style="display:flex;align-items:center;gap:10px;padding:12px 28px;border-radius:999px;
               background:linear-gradient(135deg,#7c83ff,#9aa0ff);color:#fff;font-weight:700;
               font-size:15px;border:none;cursor:pointer;font-family:'Outfit',sans-serif;
               box-shadow:0 4px 16px rgba(124,131,255,.35)">
        <i class="fa-brands fa-google"></i> Iniciar sesión con Google
      </button>
      <a href="index.html" style="color:#717a9c;font-size:13px;text-decoration:underline">Volver al catálogo</a>
    </div>`;

  byId('btn-google-login').addEventListener('click', async () => {
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    } catch (err) {
      toast('Error al iniciar sesión: ' + err.message);
    }
  });
}

function showFatalError(msg) {
  loadingView.innerHTML = `
    <div style="text-align:center;color:#ef4444;font-family:'Outfit',sans-serif;padding:40px;max-width:400px">
      <div style="font-size:36px;margin-bottom:16px">⚠️</div>
      <p style="font-size:16px;font-weight:600;margin-bottom:12px">${esc(msg)}</p>
      <a href="index.html" style="color:#7c83ff;font-size:14px;text-decoration:underline">Volver al catálogo</a>
    </div>`;
}

initAuth();
