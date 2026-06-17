import { useState } from 'react';
import '../portals.css';
import PortalHeader from './PortalHeader';
import PortalSidebar from './PortalSidebar';

export default function PortalLayout({ title, icon, user, signOutPortal, headerActions, currentPortal, children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('gyro_admin_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    return saved;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleThemeChange(next) {
    setTheme(next);
    localStorage.setItem('gyro_admin_theme', next);
    document.body.setAttribute('data-theme', next);
  }

  return (
    <div className="portal-theme portal-shell" data-theme={theme}>
      {/* A. Sidebar fijo a la izquierda (navegación por rol) */}
      <PortalSidebar
        roles={user?.roles || []}
        currentPortal={currentPortal}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* B. Columna principal: top header + contenido */}
      <div className="portal-main">
        <PortalHeader
          title={title}
          icon={icon}
          user={user}
          theme={theme}
          onThemeChange={handleThemeChange}
          signOutPortal={signOutPortal}
          actions={headerActions}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
        />

        <main className="admin-wrap">
          {children}
        </main>
      </div>
    </div>
  );
}
