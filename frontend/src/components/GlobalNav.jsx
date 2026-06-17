export const PORTALS = [
  {
    id: 'inventario',
    label: 'Gestión de Inventario',
    icon: 'fa-warehouse',
    href: '/inventario',
    roles: ['admin', 'global_admin'],
  },
  {
    id: 'catalogo',
    label: 'Gestión de Catálogo',
    icon: 'fa-tags',
    href: '/catalogo-admin.html',
    roles: ['admin', 'global_admin'],
  },
  {
    id: 'ventas',
    label: 'Gestión de Ventas',
    icon: 'fa-chart-line',
    href: '/vendedor.html',
    roles: ['seller', 'cashier', 'admin', 'global_admin'],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    icon: 'fa-chart-bar',
    href: '/reportes',
    roles: ['admin', 'global_admin'],
  },
  {
    id: 'usuarios',
    label: 'Gestión de Usuarios',
    icon: 'fa-users',
    href: '/usuarios',
    roles: ['admin', 'global_admin'],
  },
  {
    id: 'logistics',
    label: 'Gyro Logistics',
    icon: 'fa-box',
    href: '/gyrologistics',
    roles: ['admin', 'global_admin', 'logistics_admin', 'logistics_customer'],
  },
];

export function getVisiblePortals(roles = []) {
  if (!roles.length) return [];
  return PORTALS.filter(p => p.roles.some(r => roles.includes(r)));
}

// Lista de portales (según rol) para el menú lateral de la tienda (Sidebar.jsx).
export default function GlobalNav({ roles = [], currentPortal = '', onLogout }) {
  const visible = getVisiblePortals(roles);
  if (!visible.length) return null;

  return (
    <>
      <li className="sidebar-admin-group">
        <span className="sidebar-section-label" style={{ paddingLeft: 0 }}>
          Portales
        </span>
        <ul className="sidebar-submenu" style={{ display: 'flex', flexDirection: 'column' }}>
          {visible.map(p => (
            <li key={p.id}>
              <a
                href={p.href}
                style={currentPortal === p.id ? { color: 'var(--accent)', fontWeight: 700 } : {}}
              >
                <i className={`fa-solid ${p.icon}`}></i> {p.label}
              </a>
            </li>
          ))}
        </ul>
      </li>
      {onLogout && (
        <li>
          <button
            onClick={onLogout}
            style={{
              all: 'unset',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: 'var(--danger, #ef4444)',
              fontSize: '14px',
              fontWeight: 600,
              padding: '8px 0',
              width: '100%',
            }}
          >
            <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
          </button>
        </li>
      )}
    </>
  );
}
