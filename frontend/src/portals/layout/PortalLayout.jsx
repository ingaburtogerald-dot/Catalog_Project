import { useState } from 'react';
import '../portals.css';
import PortalHeader from './PortalHeader';

export default function PortalLayout({ title, icon, user, signOutPortal, headerActions, currentPortal, children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('gyro_admin_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    return saved;
  });

  function handleThemeChange(next) {
    setTheme(next);
    document.body.setAttribute('data-theme', next);
  }

  return (
    <div className="portal-theme" data-theme={theme}>
      <div className="admin-wrap">
        <PortalHeader
          title={title}
          icon={icon}
          user={user}
          theme={theme}
          onThemeChange={handleThemeChange}
          signOutPortal={signOutPortal}
          actions={headerActions}
          currentPortal={currentPortal}
        />
        {children}
      </div>
    </div>
  );
}
