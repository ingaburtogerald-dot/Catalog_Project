import { useState, useRef, useEffect } from 'react';
import { useAdminNotifications } from './useAdminNotifications';

function NotifRow({ n, onNavigate }) {
  return (
    <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: `${n.color}1f`, color: n.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fa-solid ${n.icon}`}></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.4 }}>{n.text}</p>
        <a href={n.href} onClick={onNavigate} style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
          Revisar <i className="fa-solid fa-arrow-right" style={{ fontSize: '10px' }}></i>
        </a>
      </div>
    </div>
  );
}

export default function ActionCenter({ user }) {
  const { notifications, count } = useAdminNotifications(user);
  const [open, setOpen] = useState(false);     // dropdown
  const [drawer, setDrawer] = useState(false); // panel deslizante
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const recent = notifications.slice(0, 5);

  return (
    <>
      <div className="notif-bell" ref={ref} style={{ position: 'relative' }}>
        <button type="button" title="Notificaciones" onClick={() => setOpen(o => !o)}>
          🔔
          {count > 0 && <span className="notif-badge">{count > 9 ? '9+' : count}</span>}
        </button>

        {open && (
          <div className="notif-dropdown">
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 10px 8px', margin: 0 }}>
              Notificaciones {count > 0 && `(${count})`}
            </p>

            {notifications.length === 0 ? (
              <p className="muted-note" style={{ padding: '14px 12px' }}>No hay tareas pendientes 🎉</p>
            ) : (
              recent.map(n => (
                <div key={n.id} className="notif-item">
                  <NotifRow n={n} onNavigate={() => setOpen(false)} />
                </div>
              ))
            )}

            <div style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '6px' }}>
              <button
                type="button"
                onClick={() => { setOpen(false); setDrawer(true); }}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--btn-ghost-bg)', color: 'var(--accent)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Ver todas{notifications.length ? ` (${notifications.length})` : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Overlay + panel deslizante (drawer) */}
      <div
        onClick={() => setDrawer(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 900, opacity: drawer ? 1 : 0, pointerEvents: drawer ? 'auto' : 'none', transition: 'opacity 0.25s ease' }}
      />
      <aside
        aria-label="Centro de notificaciones"
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(420px, 92vw)',
          background: 'var(--modal-bg)', borderLeft: '1px solid var(--border)', zIndex: 901,
          transform: drawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s ease',
          display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>🔔 Centro de notificaciones</h3>
          <button type="button" onClick={() => setDrawer(false)} style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-soft)', fontSize: '18px' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style={{ padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notifications.length === 0 ? (
            <p className="muted-note" style={{ padding: '24px 12px', textAlign: 'center' }}>No hay tareas pendientes 🎉</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '13px 14px' }}>
                <NotifRow n={n} onNavigate={() => setDrawer(false)} />
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
