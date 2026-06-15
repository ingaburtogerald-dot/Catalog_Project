/* ============================================================
   GYRO STORE — Auth Global (Widget Superior & Popup de Bienvenida)
   Este script se ejecuta en todas las páginas para manejar
   la interfaz global de usuario (si tiene sesión iniciada).
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const isLoggedIn = localStorage.getItem('gyro_admin_logged_in') === 'true';
  if (!isLoggedIn) return;

  const userName = localStorage.getItem('gyro_user_name') || 'Usuario';
  const userPhoto = localStorage.getItem('gyro_user_photo') || 'assets/img/default-avatar.png';
  const userRole = localStorage.getItem('gyro_user_role') === 'seller' ? 'Vendedor' : 'Administrador';
  const portalUrl = localStorage.getItem('gyro_user_role') === 'seller' ? 'vendedor.html' : 'admin.html';

  // 1. Mostrar Popup de Bienvenida (Solo 1 vez por sesión)
  if (!sessionStorage.getItem('gyro_welcome_shown')) {
    showWelcomePopup(userName, userPhoto);
    sessionStorage.setItem('gyro_welcome_shown', 'true');
  }

  // 2. Inyectar / Actualizar Widget Superior en Portales y Catálogo
  injectOrUpdateHeaderWidget(userName, userPhoto, userRole, portalUrl);
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
      <h2 class="welcome-title">¡Hola, ${name}!</h2>
      <p class="welcome-msg">Bienvenido de nuevo a tu panel de control de Gyro Store.</p>
      <button class="btn-welcome" id="btn-welcome-close">Okay, continuar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('btn-welcome-close').addEventListener('click', () => {
    overlay.style.animation = 'fadeInWelcome 0.3s reverse';
    setTimeout(() => overlay.remove(), 300);
  });
}

function injectOrUpdateHeaderWidget(name, photo, role, portalUrl) {
  // 1. Si ya existe en Admin/Vendedor (btn-settings y menú desplegable)
  const existingAvatar = document.getElementById('user-avatar');
  const existingName = document.getElementById('menu-user-name');
  if (existingAvatar) existingAvatar.src = photo;
  if (existingName) existingName.textContent = name;

  // 2. Si estamos en index.html o producto.html, creamos el widget flotante global
  const isCatalogPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('producto.html') || window.location.pathname === '/';
  if (isCatalogPage) {
    const header = document.querySelector('header');
    if (!header) return;

    // Crear widget en la cabecera
    const widget = document.createElement('div');
    widget.id = 'global-user-widget';
    widget.style.cssText = 'position: absolute; right: 20px; top: 20px; z-index: 100;';
    widget.innerHTML = `
      <style>
        .global-widget-btn {
          background: transparent; border: 2px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 50px; padding: 4px 12px 4px 4px; display: flex; align-items: center; gap: 10px;
          cursor: pointer; transition: background 0.2s, border-color 0.2s;
        }
        .global-widget-btn:hover { background: rgba(255,255,255,0.05); border-color: var(--accent, #7c83ff); }
        .global-widget-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
        .global-widget-name { color: var(--heading-color, #fff); font-weight: 600; font-size: 14px; }
        .global-widget-menu {
          position: absolute; top: calc(100% + 8px); right: 0; background: var(--surface, #1e293b);
          border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 8px; min-width: 180px;
          display: none; flex-direction: column; gap: 4px;
        }
        .global-widget-menu.show { display: flex; animation: slideDown 0.2s ease forwards; }
        .global-widget-item {
          padding: 10px 12px; color: var(--text, #e2e8f0); text-decoration: none;
          font-size: 14px; border-radius: 8px; transition: background 0.2s; display: flex; align-items: center; gap: 8px;
        }
        .global-widget-item:hover { background: rgba(255,255,255,0.05); }
        .global-widget-logout { color: #ef4444; }
        .global-widget-logout:hover { background: rgba(239, 68, 68, 0.1); }
      </style>
      <button class="global-widget-btn" id="btn-global-widget">
        <img src="${photo}" class="global-widget-avatar" onerror="this.src='assets/img/default-avatar.png'">
        <span class="global-widget-name">${name}</span>
        <i class="fa-solid fa-chevron-down" style="font-size: 10px; color: var(--text-soft)"></i>
      </button>
      <div class="global-widget-menu" id="global-widget-menu">
        <div style="padding: 4px 12px 10px 12px; border-bottom: 1px solid var(--border); margin-bottom: 4px;">
          <div style="font-weight: 700; color: #fff; font-size: 14px;">${name}</div>
          <div style="font-size: 12px; color: var(--accent);">${role}</div>
        </div>
        <a href="${portalUrl}" class="global-widget-item">
          <i class="fa-solid fa-gauge"></i> Ir a mi Panel
        </a>
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
      localStorage.removeItem('gyro_admin_logged_in');
      localStorage.removeItem('gyro_admin_dev_mode');
      localStorage.removeItem('gyro_user_name');
      localStorage.removeItem('gyro_user_photo');
      localStorage.removeItem('gyro_user_role');
      sessionStorage.removeItem('gyro_welcome_shown');
      window.location.reload();
    });
  }
}
