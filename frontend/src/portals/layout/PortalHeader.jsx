import { useState } from 'react';
import SettingsModal from './SettingsModal';

export default function PortalHeader({ title, icon, user, theme, onThemeChange, signOutPortal, actions }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="admin-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src="/assets/img/Gyro_Store_logo.jpeg" alt="Logo de Gyro Store"
          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }}
        />
        <h1>
          {icon} {title}
          <a href="/" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-soft)', marginLeft: 8 }}>← Ver tienda</a>
        </h1>
      </div>

      {/* .user-box: assets/js/auth-global.js inyecta aquí el selector de paneles automáticamente. */}
      <div className="user-box">
        {actions}
        <img src={user.photoURL || '/assets/img/Gyro_Store_logo.jpeg'} alt="" />
        <span>{user.email}</span>
        <button
          type="button" className="btn-ghost" title="Configuración"
          style={{ fontSize: 16, padding: 8 }}
          onClick={() => setShowSettings(true)}
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <SettingsModal
          theme={theme}
          onThemeChange={onThemeChange}
          onClose={() => setShowSettings(false)}
          onLogout={signOutPortal}
        />
      )}
    </div>
  );
}
