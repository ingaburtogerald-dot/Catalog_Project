import { useUserRoles } from '../hooks/useUserRoles';

export default function Sidebar({ open, onClose, categories, activeCategory, onSelectCategory }) {
  const { isAdmin, isSeller, isLogisticsOnly } = useUserRoles();
  const currentUrl = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);

  const allCategories = [{ id: 'all', name: 'Todo el catálogo', icon: '🛍️' }, ...categories];

  return (
    <>
      <div className="overlay" hidden={!open} onClick={onClose}></div>
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Menú de categorías" aria-hidden={!open}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img className="logo-compacto" src="/assets/img/Gyro_Store_logo.jpeg" alt="Logo de Gyro Store" />
            <span className="sidebar-title">GYRO STORE</span>
          </div>
          <button className="icon-btn" aria-label="Cerrar menú" onClick={onClose}>✕</button>
        </div>

        <nav className="sidebar-nav" aria-label="Categorías de productos">
          <p className="sidebar-section-label">Categorías</p>
          <ul>
            {allCategories.map((c) => (
              <li key={c.id}>
                <a
                  href={`?cat=${encodeURIComponent(c.id)}`}
                  className={c.id === activeCategory ? 'active' : ''}
                  onClick={(e) => { e.preventDefault(); onSelectCategory(c.id); onClose(); }}
                >
                  {c.icon} {c.name}
                </a>
              </li>
            ))}

            {isAdmin ? (
              <>
                <li className="sidebar-admin-group">
                  <span className="sidebar-section-label" style={{ paddingLeft: 0 }}>Panel de Administración</span>
                  <ul className="sidebar-submenu" style={{ display: 'flex', flexDirection: 'column' }}>
                    <li><a href="/admin.html"><i className="fa-solid fa-warehouse"></i> Portal de Inventario</a></li>
                    <li><a href="/vendedor.html"><i className="fa-solid fa-chart-line"></i> Portal de Ventas</a></li>
                    <li><a href="/analytics.html"><i className="fa-solid fa-chart-bar"></i> Portal de Reportes</a></li>
                    <li><a href="/usuarios.html"><i className="fa-solid fa-users"></i> Gestión de Usuarios</a></li>
                    <li><a href="/gyrologistics.html"><i className="fa-solid fa-box"></i> Gyro Logistics</a></li>
                  </ul>
                </li>
                <li><a href={`/admin.html?logout=true&from=${currentUrl}`} style={{ color: 'var(--danger, #ef4444)' }}>
                  <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
                </a></li>
              </>
            ) : isSeller ? (
              <>
                <li><a href="/vendedor.html"><i className="fa-solid fa-store"></i> Portal de Ventas</a></li>
                <li><a href={`/vendedor.html?logout=true&from=${currentUrl}`} style={{ color: 'var(--danger, #ef4444)' }}>
                  <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
                </a></li>
              </>
            ) : isLogisticsOnly ? (
              <>
                <li><a href="/gyrologistics.html"><i className="fa-solid fa-box"></i> Gyro Logistics</a></li>
                <li><a href={`/gyrologistics.html?logout=true&from=${currentUrl}`} style={{ color: 'var(--danger, #ef4444)' }}>
                  <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
                </a></li>
              </>
            ) : (
              <li><a href={`/admin.html?from=${currentUrl}`}><i className="fa-solid fa-lock"></i> Iniciar Sesión</a></li>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-location">📍 Managua, conchita palacios 2c al lago, 1c arriba</p>
        </div>
      </aside>
    </>
  );
}
