import { useState, useEffect, useRef } from 'react';

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

// mode="sidebar"   → lista completa de portales (usada en Sidebar.jsx del catálogo)
// mode="switcher"  → dropdown compacto (usada en PortalHeader.jsx dentro de portales)
export default function GlobalNav({ roles = [], currentPortal = '', mode = 'sidebar', onLogout }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const visible = getVisiblePortals(roles);

  useEffect(() => {
    if (mode !== 'switcher') return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mode]);

  if (!visible.length) return null;

  // ── MODO SIDEBAR ────────────────────────────────────────────────────────
  if (mode === 'sidebar') {
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

  // ── MODO SWITCHER (dropdown en portal) ──────────────────────────────────
  const currentDef = PORTALS.find(p => p.id === currentPortal);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-ghost"
        title="Cambiar de portal"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          fontSize: '13px',
          padding: '7px 13px',
          borderRadius: '8px',
        }}
      >
        <i className="fa-solid fa-grip"></i>
        <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentDef?.label || 'Portales'}
        </span>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: '10px' }}></i>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '220px',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
            padding: '6px',
            zIndex: 200,
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 10px 4px', margin: 0 }}>
            Cambiar de portal
          </p>
          {visible.map(p => (
            <a
              key={p.id}
              href={p.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 600,
                color: currentPortal === p.id ? 'var(--accent)' : 'var(--text)',
                background: currentPortal === p.id ? 'rgba(124,131,255,0.08)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (currentPortal !== p.id) e.currentTarget.style.background = 'var(--btn-ghost-bg)'; }}
              onMouseLeave={e => { if (currentPortal !== p.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <i className={`fa-solid ${p.icon}`} style={{ width: '16px', textAlign: 'center', color: currentPortal === p.id ? 'var(--accent)' : 'var(--text-soft)' }}></i>
              {p.label}
              {currentPortal === p.id && (
                <i className="fa-solid fa-check" style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: '11px' }}></i>
              )}
            </a>
          ))}
          {onLogout && (
            <>
              <div style={{ height: '1px', background: 'var(--border)', margin: '6px 0' }} />
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                style={{
                  all: 'unset',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#ef4444',
                  cursor: 'pointer',
                  width: '100%',
                  boxSizing: 'border-box',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <i className="fa-solid fa-right-from-bracket" style={{ width: '16px', textAlign: 'center' }}></i>
                Cerrar Sesión
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
