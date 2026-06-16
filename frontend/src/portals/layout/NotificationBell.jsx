import { useState } from 'react';

const money = (currency, n) => `${currency}${Number(n || 0).toFixed(2)}`;

export default function NotificationBell({ items, unreadCount, onOpen, currency = 'C$' }) {
  const [open, setOpen] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
  }

  return (
    <div className="notif-bell">
      <button type="button" title="Notificaciones" onClick={toggle}>
        🔔
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          {items.length === 0 ? (
            <p className="muted-note" style={{ padding: 12 }}>No hay notificaciones todavía.</p>
          ) : (
            items.map((n) => (
              <div key={`${n.id}-${n.status}`} className="notif-item">
                <span className={`notif-status ${n.status}`}>
                  {n.status === 'approved' ? '✅ Venta aprobada' : '❌ Venta rechazada'}
                </span>
                <div className="muted-note">{n.productNames}</div>
                {n.status === 'approved' ? (
                  <div>Comisión: <strong>{money(currency, n.commissionTotal)}</strong></div>
                ) : (
                  n.rejectionReason && <div className="muted-note">Motivo: {n.rejectionReason}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
