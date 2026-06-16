/* ============================================================
   GYRO STORE — Auth Global (Widget Superior & Popup de Bienvenida)
   Este script se ejecuta en todas las páginas para manejar
   la interfaz global de usuario (si tiene sesión iniciada).
   ============================================================ */

// ── Bloqueo de dev mode (se ejecuta ANTES que los módulos diferidos) ───────
// Elimina la clave de localStorage y el parámetro ?dev=true de la URL para
// que ningún portal omita la autenticación real de Firebase.
(function blockDevMode() {
  const ADMIN_PAGES = ['admin.html', 'vendedor.html', 'analytics.html', 'usuarios.html', 'gyrologistics.html'];
  const page = location.pathname.split('/').pop() || '';
  if (!ADMIN_PAGES.includes(page)) return;

  // Quitar clave de localStorage
  localStorage.removeItem('gyro_admin_dev_mode');

  // Quitar ?dev=... de la URL sin recargar la página
  const url = new URL(location.href);
  if (url.searchParams.has('dev')) {
    url.searchParams.delete('dev');
    history.replaceState(null, '', url.toString());
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const isLoggedIn = localStorage.getItem('gyro_admin_logged_in') === 'true';
  if (!isLoggedIn) return;

  const userName = localStorage.getItem('gyro_user_name') || 'Usuario';
  const userPhoto = localStorage.getItem('gyro_user_photo') || 'assets/img/default-avatar.png';
  const role = localStorage.getItem('gyro_user_role');
  let roles = [];
  try { roles = JSON.parse(localStorage.getItem('gyro_user_roles') || '[]'); } catch { roles = role ? [role] : []; }

  const ROLE_LABELS = {
    global_admin: 'Administrador Global', admin: 'Administrador', seller: 'Vendedor', cashier: 'Cajero',
    logistics_admin: 'Admin. Logística', logistics_customer: 'Cliente Gyro Logistics',
  };
  const isAdmin = roles.includes('admin') || roles.includes('global_admin');
  const isSeller = !isAdmin && roles.some((r) => ['seller', 'cashier'].includes(r));
  const isLogistics = isAdmin || roles.includes('logistics_admin') || roles.includes('logistics_customer');
  const userRole = ROLE_LABELS[role] || (isSeller ? 'Vendedor' : 'Administrador');

  // 1. Mostrar Popup de Bienvenida (Solo 1 vez por sesión)
  if (!sessionStorage.getItem('gyro_welcome_shown')) {
    showWelcomePopup(userName, userPhoto);
    sessionStorage.setItem('gyro_welcome_shown', 'true');
  }

  // 2. Inyectar / Actualizar Widget Superior en Portales y Catálogo
  injectOrUpdateHeaderWidget(userName, userPhoto, userRole, { isAdmin, isSeller, isLogistics });
});

function showWelcomePopup(name, photo) {
  const overlay = document.createElement('div');
  overlay.id = 'welcome-modal-overlay';
  overlay.innerHTML = `
    <style>
      #welcome-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.7);
        backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        opacity: 0; animation: fadeInWelcome 0.4s forwards;
      }
      .welcome-modal {
        background: var(--surface, #1e293b);
        border: 1px solid var(--border, rgba(255,255,255,0.1));
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        max-width: 400px; width: 90%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        transform: translateY(20px) scale(0.95);
        animation: slideUpWelcome 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .welcome-avatar {
        width: 80px; height: 80px; border-radius: 50%;
        object-fit: cover; border: 3px solid var(--accent, #7c83ff);
        margin: 0 auto 20px auto;
        box-shadow: 0 0 20px rgba(124, 131, 255, 0.4);
      }
      .welcome-title { color: var(--heading-color, #fff); font-size: 24px; margin-bottom: 8px; font-weight: 700; }
      .welcome-msg { color: var(--text-soft, #aab2cf); font-size: 15px; margin-bottom: 30px; }
      .btn-welcome {
        background: var(--accent, #7c83ff); color: #fff;
        border: none; padding: 12px 30px; border-radius: 30px;
        font-weight: 600; font-size: 16px; cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        width: 100%;
      }
      .btn-welcome:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(124, 131, 255, 0.3); }
      @keyframes fadeInWelcome { to { opacity: 1; } }
      @keyframes slideUpWelcome { to { transform: translateY(0) scale(1); } }
    </style>
    <div class="welcome-modal">
      <img src="${photo}" alt="Avatar" class="welcome-avatar" onerror="this.src='assets/img/default-avatar.png'">
      <h2 class="welcome-title">¡Bienvenido a la página web de Gyro Store! 👋</h2>
      <p class="welcome-msg">Qué gusto verte de nuevo, ${name}. Tu panel está listo para ti.</p>
      <button class="btn-welcome" id="btn-welcome-close">Okay, continuar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('btn-welcome-close').addEventListener('click', () => {
    overlay.style.animation = 'fadeInWelcome 0.3s reverse';
    setTimeout(() => overlay.remove(), 300);
  });
}

// ── Estilos compartidos del menú de navegación (widget catálogo + selector de paneles) ──
const WIDGET_CSS = `
  .global-widget-btn {
    background: transparent; border: 2px solid var(--border, rgba(255,255,255,0.1));
    border-radius: 50px; padding: 4px 12px 4px 4px; display: flex; align-items: center; gap: 10px;
    cursor: pointer; transition: background 0.2s, border-color 0.2s; color: inherit; font: inherit;
  }
  .global-widget-btn:hover { background: rgba(255,255,255,0.05); border-color: var(--accent, #7c83ff); }
  .global-widget-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .global-widget-name { color: var(--heading-color, #fff); font-weight: 600; font-size: 14px; }
  .global-widget-menu {
    position: absolute; top: calc(100% + 8px); right: 0; background: var(--surface, #1e293b);
    border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 8px; min-width: 200px;
    display: none; flex-direction: column; gap: 4px; z-index: 200;
  }
  .global-widget-menu.show { display: flex; animation: slideDown 0.2s ease forwards; }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  .global-widget-item {
    padding: 10px 12px; color: var(--text, #e2e8f0); text-decoration: none;
    font-size: 14px; border-radius: 8px; transition: background 0.2s; display: flex; align-items: center; gap: 8px;
    border: none; background: none; cursor: pointer; width: 100%; text-align: left; font: inherit;
  }
  .global-widget-item:hover { background: rgba(255,255,255,0.05); }
  .global-widget-item.current { color: var(--muted, #717a9c); cursor: default; }
  .global-widget-item.current:hover { background: none; }
  .global-widget-item.current .current-tag { margin-left: auto; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--accent, #7c83ff); }
  .global-widget-logout { color: #ef4444; }
  .global-widget-logout:hover { background: rgba(239, 68, 68, 0.1); }
  .global-widget-divider { height: 1px; background: var(--border, rgba(255,255,255,0.08)); margin: 4px 0; }
  .global-widget-section { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--muted, #717a9c); padding: 6px 12px 2px; }
`;

function ensureWidgetStyles() {
  if (document.getElementById('auth-global-widget-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-global-widget-styles';
  style.textContent = WIDGET_CSS;
  document.head.appendChild(style);
}

// Lista única de paneles — un solo lugar para agregar futuros portales.
const PORTALS = [
  { page: 'admin.html',         icon: 'fa-warehouse',   label: 'Portal de Inventario', allow: (c) => c.isAdmin },
  { page: 'vendedor.html',      icon: 'fa-chart-line',  label: 'Portal de Ventas',     allow: (c) => c.isAdmin || c.isSeller },
  { page: 'analytics.html',     icon: 'fa-chart-bar',   label: 'Portal de Reportes',   allow: (c) => c.isAdmin },
  { page: 'usuarios.html',      icon: 'fa-users',       label: 'Gestión de Usuarios',  allow: (c) => c.isAdmin },
  { page: 'gyrologistics.html', icon: 'fa-box',         label: 'Gyro Logistics',       allow: (c) => c.isLogistics },
];

function buildPortalMenuItems(ctx, currentPage) {
  return PORTALS.filter((p) => p.allow(ctx)).map((p) => {
    if (p.page === currentPage) {
      return `<span class="global-widget-item current"><i class="fa-solid ${p.icon}"></i> ${p.label} <span class="current-tag">actual</span></span>`;
    }
    return `<a href="${p.page}" class="global-widget-item"><i class="fa-solid ${p.icon}"></i> ${p.label}</a>`;
  }).join('');
}

function injectOrUpdateHeaderWidget(name, photo, role, ctx) {
  // 1. Si ya existe en Admin/Vendedor (avatar y nombre en su propio menú nativo)
  const existingAvatar = document.getElementById('user-avatar');
  const existingName = document.getElementById('menu-user-name');
  if (existingAvatar) existingAvatar.src = photo;
  if (existingName) existingName.textContent = name;

  ensureWidgetStyles();

  // 2. Catálogo (index.html / producto.html): widget flotante con foto + nombre
  const isCatalogPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('producto.html') || window.location.pathname === '/';
  if (isCatalogPage) {
    injectCatalogWidget(name, photo, role, ctx);
  } else {
    injectPortalSwitcher(ctx);
  }
}

function injectCatalogWidget(name, photo, role, ctx) {
  const header = document.querySelector('header');
  if (!header || document.getElementById('global-user-widget')) return;

  const widget = document.createElement('div');
  widget.id = 'global-user-widget';
  widget.style.cssText = 'position: absolute; right: 20px; top: 20px; z-index: 100;';
  widget.innerHTML = `
    <button class="global-widget-btn" id="btn-global-widget" type="button">
      <img src="${photo}" class="global-widget-avatar" onerror="this.src='assets/img/default-avatar.png'">
      <span class="global-widget-name">${name}</span>
      <i class="fa-solid fa-chevron-down" style="font-size: 10px; color: var(--text-soft)"></i>
    </button>
    <div class="global-widget-menu" id="global-widget-menu">
      <div style="padding: 4px 12px 10px 12px; border-bottom: 1px solid var(--border); margin-bottom: 4px;">
        <div style="font-weight: 700; color: #fff; font-size: 14px;">${name}</div>
        <div style="font-size: 12px; color: var(--accent);">${role}</div>
      </div>
      ${buildPortalMenuItems(ctx, null)}
      <div class="global-widget-divider"></div>
      <a href="#" class="global-widget-item global-widget-logout" id="btn-global-logout">
        <i class="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
      </a>
    </div>
  `;
  header.appendChild(widget);

  document.getElementById('btn-global-widget').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('global-widget-menu').classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('global-widget-menu');
    if (menu && menu.classList.contains('show') && !widget.contains(e.target)) {
      menu.classList.remove('show');
    }
  });

  document.getElementById('btn-global-logout').addEventListener('click', (e) => {
    e.preventDefault();
    gyroSignOut();
  });
}

// Inyecta un selector de paneles dentro del .user-box de cada portal (admin/vendedor/
// analytics/usuarios/gyrologistics), para poder saltar de uno a otro sin escribir la URL.
function injectPortalSwitcher(ctx) {
  const userBox = document.querySelector('.user-box');
  // Si la página ya tiene su propio menú de navegación funcional (ej. analytics.html,
  // que además maneja tema y cierre de sesión ahí), no dupliquemos el selector.
  if (!userBox || document.getElementById('btn-portal-switcher') || document.getElementById('user-menu-dropdown')) return;

  const currentPage = window.location.pathname.split('/').pop() || '';
  const items = buildPortalMenuItems(ctx, currentPage);
  const hasOtherPanels = PORTALS.some((p) => p.allow(ctx) && p.page !== currentPage);
  if (!hasOtherPanels) return; // nada a donde cambiar (ej. cliente de logística en su única página)

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position: relative; display: inline-flex;';
  wrap.innerHTML = `
    <button class="global-widget-btn" id="btn-portal-switcher" type="button" title="Cambiar de panel">
      <i class="fa-solid fa-grip"></i>
      <i class="fa-solid fa-chevron-down" style="font-size: 10px; color: var(--text-soft)"></i>
    </button>
    <div class="global-widget-menu" id="portal-switcher-menu" style="left: 0; right: auto;">
      <a href="/" class="global-widget-item"><i class="fa-solid fa-cart-shopping"></i> Volver al Catálogo</a>
      <div class="global-widget-divider"></div>
      <div class="global-widget-section">Cambiar de panel</div>
      ${items}
    </div>
  `;
  userBox.insertBefore(wrap, userBox.firstChild);

  const btn = wrap.querySelector('#btn-portal-switcher');
  const menu = wrap.querySelector('#portal-switcher-menu');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) menu.classList.remove('show');
  });
}

// ── Utilidad de cierre de sesión ───────────────────────────────────────────
function clearGyroSession() {
  localStorage.removeItem('gyro_admin_logged_in');
  localStorage.removeItem('gyro_admin_dev_mode');
  localStorage.removeItem('gyro_user_name');
  localStorage.removeItem('gyro_user_photo');
  localStorage.removeItem('gyro_user_role');
  localStorage.removeItem('gyro_user_roles');
  localStorage.removeItem('gyro_last_activity');
  sessionStorage.removeItem('gyro_welcome_shown');
}

function gyroSignOut(reason) {
  clearGyroSession();
  // Redirigir a admin.html con ?logout=true para que admin.js llame a Firebase signOut()
  const hint = reason ? `&reason=${reason}` : '';
  window.location.href = `admin.html?logout=true${hint}`;
}

// ── Guardia de inactividad (30 minutos) ────────────────────────────────────
(function initInactivityGuard() {
  const TIMEOUT_MS   = 30 * 60 * 1000; // 30 minutos
  const CHECK_MS     = 60 * 1000;      // revisar cada minuto
  const ACTIVITY_KEY = 'gyro_last_activity';
  const ADMIN_PAGES  = ['admin.html', 'vendedor.html', 'analytics.html', 'usuarios.html', 'gyrologistics.html'];

  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (!ADMIN_PAGES.includes(page)) return; // solo portales admin

  function bump() {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  }

  function check() {
    const last = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
    if (last && Date.now() - last > TIMEOUT_MS) {
      gyroSignOut('inactivity');
    }
  }

  // Inicializar timestamp al cargar la página
  bump();

  // Resetear en cualquier interacción del usuario
  ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(ev =>
    document.addEventListener(ev, bump, { passive: true }));

  // Revisar periódicamente
  setInterval(check, CHECK_MS);
})();
