/* ============================================================
   GYRO STORE — Analytics Dashboard
   Panel de análisis de ventas y comisiones. Requiere cuenta autorizada.
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  signInWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const API = '/api';
let CONFIG = { currency: 'C$', categories: [] };
let auth = null;

/* ---------- utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${CONFIG.currency}${Number(n).toFixed(2)}`;
const $ = (s, c = document) => c.querySelector(s);

function parseCustomTimestamp(ts) {
  if (!ts) return null;
  if (ts === 'Fecha anterior') return null;
  if (ts instanceof Date) return ts;

  let d = new Date(ts);
  if (!isNaN(d.getTime())) return d;

  try {
    const parts = String(ts).split(',');
    if (parts.length >= 2) {
      const dateParts = parts[0].trim().split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const year = parseInt(dateParts[2]);

        let timeStr = parts[1].trim();
        timeStr = timeStr.replace(/\u202f/g, ' ');

        const isPM = /p\.\s*m\.|pm/i.test(timeStr);
        const isAM = /a\.\s*m\.|am/i.test(timeStr);

        const timeParts = timeStr.replace(/[^\d:]/g, '').split(':');
        if (timeParts.length >= 2) {
          let hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          const seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;

          if (isPM && hours < 12) hours += 12;
          if (isAM && hours === 12) hours = 0;

          const parsedDate = new Date(year, month, day, hours, minutes, seconds);
          if (!isNaN(parsedDate.getTime())) return parsedDate;
        }
      }
    }
  } catch { }
  return null;
}


function formatFriendlyDate(dateInput) {
  if (!dateInput) return 'Fecha anterior';
  const d = parseCustomTimestamp(dateInput);
  if (!d) return dateInput;
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} de ${month} de ${year}, ${hours}:${minutes} ${ampm}`;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const urlParams = new URLSearchParams(window.location.search);
  const isDevMode = urlParams.get('dev') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'true';
  if (isDevMode) {
    headers.Authorization = 'Bearer dev-token';
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
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 300); }, 2600);
}

/* ============================================================
   ============================================================ */
function showLogin(errorMsg) {
  const loadingView = $('#loading-view');
  if (loadingView) loadingView.classList.add('hidden');
  const loginView = $('#login-view');
  if (loginView) loginView.classList.remove('hidden');
  const panelView = $('#panel-view');
  if (panelView) panelView.classList.add('hidden');
  if (errorMsg) {
    const errEl = $('#login-error');
    if (errEl) {
      errEl.textContent = errorMsg;
      errEl.classList.remove('hidden');
    }
  }
}

async function loadAnalytics() {
  try {
    const orders = await api('/orders');
    const approvedOrders = orders.filter(o => o.status === 'approved');

    let totalSales = 0;
    let totalCosts = 0;
    let totalProfit = 0;
    let totalCommissions = 0;

    const sellerData = {};

    approvedOrders.forEach(o => {
      totalSales += o.total || 0;
      totalCosts += o.realCostTotal || 0;
      totalProfit += o.netProfitTotal || 0;
      totalCommissions += o.commissionTotal || 0;

      if (o.channel === 'seller' && o.sellerName) {
        if (!sellerData[o.sellerName]) {
          sellerData[o.sellerName] = { count: 0, total: 0, comm: 0 };
        }
        sellerData[o.sellerName].count++;
        sellerData[o.sellerName].total += o.total || 0;
        sellerData[o.sellerName].comm += o.commissionTotal || 0;
      }
    });

    const kpiSales = document.getElementById('kpi-sales');
    if (kpiSales) kpiSales.textContent = money(totalSales);
    const kpiCosts = document.getElementById('kpi-costs');
    if (kpiCosts) kpiCosts.textContent = money(totalCosts);
    const kpiProfit = document.getElementById('kpi-profit');
    if (kpiProfit) kpiProfit.textContent = money(totalProfit);
    const kpiCommissions = document.getElementById('kpi-commissions');
    if (kpiCommissions) kpiCommissions.textContent = money(totalCommissions);

    const tbody = document.getElementById('commissions-tbody');
    if (tbody) {
      const sellers = Object.keys(sellerData);
      if (sellers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="color: var(--text-soft); padding: 16px;">No hay comisiones por ventas registradas.</td></tr>';
      } else {
        tbody.innerHTML = sellers.map(s => {
          const d = sellerData[s];
          return `
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px; font-weight: 700; color: var(--heading-color);">${s}</td>
              <td style="padding: 12px; color: var(--text-soft);">${d.count}</td>
              <td style="padding: 12px; font-weight: 600; color: var(--text);">${money(d.total)}</td>
              <td style="padding: 12px; font-weight: 800; color: var(--accent);">${money(d.comm)}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error("Error loading analytics:", err);
  }
}

async function showPanel(user) {
  localStorage.setItem('gyro_admin_logged_in', 'true');
  localStorage.setItem('gyro_user_name', user.displayName || user.email.split('@')[0] || '');
  localStorage.setItem('gyro_user_photo', user.photoURL || '');
  localStorage.setItem('gyro_user_role', user.role || '');

  if (user.role === 'seller') {
    localStorage.setItem('gyro_admin_dev_mode', 'seller');
    window.location.href = 'vendedor.html' + window.location.search;
    return;
  }

  const loadingView = document.getElementById('loading-view');
  if (loadingView) loadingView.classList.add('hidden');

  const loginView = document.getElementById('login-view');
  if (loginView) loginView.classList.add('hidden');
  
  const panelView = document.getElementById('panel-view');
  if (panelView) panelView.classList.remove('hidden');

  const userName = document.getElementById('user-name');
  if (userName) userName.textContent = user.displayName || user.email.split('@')[0];
  
  const userRole = document.getElementById('user-role');
  if (userRole) userRole.textContent = user.role.toUpperCase();
  
  const userAvatar = document.getElementById('user-avatar');
  if (userAvatar && user.photoURL) userAvatar.src = user.photoURL;

  // Sincronizar el nombre de usuario en el menú desplegable
  const menuUserName = document.getElementById('menu-user-name');
  if (menuUserName) {
    menuUserName.textContent = user.displayName || user.email.split('@')[0];
  }

  await loadAnalytics();
}

async function init() {
  // Cargar y aplicar tema guardado
  const savedTheme = localStorage.getItem('gyro_admin_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);

  // Controladores para el Menú Desplegable de Usuario
  const btnSettings = document.getElementById('btn-settings');
  const userMenu = document.getElementById('user-menu-dropdown');
  if (btnSettings && userMenu) {
    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('hidden');
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      const themeSelect = document.getElementById('menu-theme-select');
      if (themeSelect) themeSelect.value = currentTheme;
    });
    document.addEventListener('click', (e) => {
      if (!userMenu.classList.contains('hidden') && !userMenu.contains(e.target) && e.target !== btnSettings) {
        userMenu.classList.add('hidden');
      }
    });
  }

  // Cambio de Tema en el Menú
  const themeSelect = document.getElementById('menu-theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('gyro_admin_theme', theme);
      toast('Tema actualizado.');
    });
  }

  // Cierre de Sesión desde el Menú
  const btnMenuLogout = document.getElementById('btn-menu-logout');
  if (btnMenuLogout) {
    btnMenuLogout.addEventListener('click', () => {
      userMenu.classList.add('hidden');
      localStorage.removeItem('gyro_admin_logged_in');
      localStorage.removeItem('gyro_admin_dev_mode');
      const urlParams = new URLSearchParams(window.location.search);
      const isDevMode = urlParams.get('dev') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'true';
      if (isDevMode) {
        window.location.href = window.location.pathname;
      } else if (auth) {
        signOut(auth).catch(() => {});
      } else {
        showLogin();
      }
    });
  }

  // Dev Login
  const urlParams = new URLSearchParams(window.location.search);
  const isDevMode = urlParams.get('dev') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'true';
  const btnDev = document.getElementById('btn-dev-login');
  
  if (isDevMode) {
    if (btnDev) {
      btnDev.classList.remove('hidden');
      btnDev.addEventListener('click', () => {
        localStorage.setItem('gyro_admin_dev_mode', 'true');
        showPanel({
          email: 'dev-admin@gyrostore.com',
          photoURL: '../assets/img/Gyro_Store_logo.jpeg',
          displayName: 'Gerald Inga',
          role: 'admin'
        });
      });
    }
  }

  if (urlParams.get('logout') === 'true') {
    if (auth) signOut(auth).catch(()=>{});
    localStorage.removeItem('gyro_admin_logged_in');
    localStorage.removeItem('gyro_admin_dev_mode');
    return;
  }

  if (isDevMode && localStorage.getItem('gyro_admin_dev_mode') === 'true') {
    showPanel({
      email: 'dev-admin@gyrostore.com',
      photoURL: '../assets/img/Gyro_Store_logo.jpeg',
      displayName: 'Gerald Inga',
      role: 'admin'
    });
    return;
  }

  // Firebase auth check
  let fbConfig;
  try { fbConfig = await api('/auth/config'); } catch { return showLogin(); }
  if (!fbConfig.configured) return showLogin();

  const app = initializeApp(fbConfig);
  auth = getAuth(app);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return showLogin();
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
      showLogin(err.status === 403 ? 'Esta cuenta no tiene permisos autorizados.' : 'Error de sesión');
    }
  });

  const emailForm = document.getElementById('email-login-form');
  if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const em = document.getElementById('login-email').value;
      const pw = document.getElementById('login-password').value;
      try {
        await signInWithEmailAndPassword(auth, em, pw);
      } catch (err) {
        showLogin('Credenciales inválidas.');
      }
    });
  }

  const btnGoogle = document.getElementById('btn-google');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (err) {
        showLogin('Error con Google.');
      }
    });
  }
}

init();
