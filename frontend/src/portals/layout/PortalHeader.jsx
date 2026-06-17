import { useState, useRef, useEffect } from 'react';
import SettingsModal from './SettingsModal';
import ProfileModal from './ProfileModal';
import ActionCenter from './ActionCenter';

// Top header del dashboard.
//   Izquierda: solo el título de la vista actual.
//   Centro:    vacío (Flexbox absorbe el espacio con justify-content: space-between).
//   Derecha:   campana de notificaciones + avatar con menú desplegable.
export default function PortalHeader({ title, icon, user, theme, onThemeChange, signOutPortal, actions, onToggleSidebar }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const menuRef = useRef(null);
  const isAdmin = (user?.roles || []).some(r => r === 'admin' || r === 'global_admin');

  // Cerrar el dropdown al hacer clic fuera de él.
  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function toggleTheme() {
    onThemeChange(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <header className="portal-topbar">
      {/* ── Extremo izquierdo: título de la vista (+ hamburguesa en móvil) ── */}
      <div className="portal-topbar-left">
        <button
          type="button"
          className="portal-topbar-burger"
          onClick={onToggleSidebar}
          aria-label="Abrir menú lateral"
        >
          <i className="fa-solid fa-bars"></i>
        </button>
        <h1 className="portal-topbar-title">
          <span aria-hidden="true">{icon}</span> {title}
        </h1>
      </div>

      {/* ── Extremo derecho: notificaciones + avatar ── */}
      <div className="portal-topbar-right">
        {isAdmin ? (
          <ActionCenter user={user} />
        ) : (
          actions || (
            <div className="notif-bell">
              <button type="button" title="Notificaciones">🔔</button>
            </div>
          )
        )}

        <div className="portal-avatar-menu" ref={menuRef}>
          <button
            type="button"
            className={`portal-avatar-btn${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={user?.email}
          >
            <img src={user?.photoURL || '/assets/img/Gyro_Store_logo.jpeg'} alt="Abrir menú de usuario" />
          </button>

          {menuOpen && (
            <div className="portal-avatar-dropdown" role="menu">
              <div className="portal-avatar-head">
                <img src={user?.photoURL || '/assets/img/Gyro_Store_logo.jpeg'} alt="" />
                <div className="portal-avatar-head-info">
                  <strong>{user?.displayName || 'Mi cuenta'}</strong>
                  <span>{user?.email}</span>
                </div>
              </div>

              <button
                type="button" className="portal-avatar-item" role="menuitem"
                onClick={() => { setMenuOpen(false); setShowProfile(true); }}
              >
                <i className="fa-solid fa-user"></i> Mi Perfil
              </button>
              <button
                type="button" className="portal-avatar-item" role="menuitem"
                onClick={() => { setMenuOpen(false); setShowSettings(true); }}
              >
                <i className="fa-solid fa-gear"></i> Configuración
              </button>
              <button
                type="button" className="portal-avatar-item" role="menuitem"
                onClick={toggleTheme}
              >
                <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                Cambiar Tema
              </button>

              <div className="portal-avatar-divider" />

              <button
                type="button" className="portal-avatar-item danger" role="menuitem"
                onClick={() => { setMenuOpen(false); signOutPortal(); }}
              >
                <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          theme={theme}
          onThemeChange={onThemeChange}
          onClose={() => setShowSettings(false)}
          onLogout={signOutPortal}
        />
      )}
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
    </header>
  );
}
