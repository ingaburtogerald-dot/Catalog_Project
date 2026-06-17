import { getVisiblePortals } from '../../components/GlobalNav';

// Menú lateral fijo del dashboard. Renderiza los enlaces de portales
// condicionalmente según los roles del usuario (un vendedor solo ve Ventas, etc.).
export default function PortalSidebar({ roles = [], currentPortal, open = false, onClose }) {
  const visible = getVisiblePortals(roles);

  return (
    <>
      <div
        className={`portal-sidebar-overlay${open ? ' show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`portal-sidebar${open ? ' open' : ''}`}>
        {/* Cabecera del sidebar: logo */}
        <div className="portal-sidebar-head">
          <img
            className="portal-sidebar-logo"
            src="/assets/img/Gyro_Store_logo.jpeg"
            alt="Logo de Gyro Store"
          />
          <div className="portal-sidebar-brand">
            <strong>Gyro Store</strong>
            <span>Panel de administración</span>
          </div>
        </div>

        {/* Cuerpo del sidebar: navegación entre portales (según rol) */}
        <nav className="portal-sidebar-nav">
          <span className="portal-sidebar-label">Portales</span>
          {visible.map((p) => (
            <a
              key={p.id}
              href={p.href}
              className={`portal-sidebar-link${currentPortal === p.id ? ' active' : ''}`}
              aria-current={currentPortal === p.id ? 'page' : undefined}
            >
              <i className={`fa-solid ${p.icon}`} aria-hidden="true"></i>
              <span>{p.label}</span>
            </a>
          ))}
        </nav>

        {/* Pie del sidebar: volver a la tienda */}
        <a href="/" className="portal-sidebar-foot">
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
          <span>Ver tienda</span>
        </a>
      </aside>
    </>
  );
}
