const STATUSES = ['pending', 'paid', 'delivered', 'cancelled'];

function money(currency, n) { return `${currency}${Number(n || 0).toFixed(2)}`; }

function formatDate(createdAt) {
  if (createdAt && createdAt._seconds) return new Date(createdAt._seconds * 1000).toLocaleString('es-NI');
  if (createdAt && createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleString('es-NI');
  return '—';
}

export default function OrdersTab({ orders, currency, onUpdateStatus, onToast }) {
  if (!orders.length) {
    return <p className="muted-note">Aún no hay pedidos registrados.</p>;
  }

  async function handleStatusChange(id, status) {
    try {
      await onUpdateStatus(id, status);
      onToast(`Pedido #${id.slice(0, 6)} → ${status}`);
    } catch (err) {
      onToast(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Productos</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const items = o.lines.map((l) => `${l.name}${l.variant ? ` (${l.variant})` : ''} x${l.qty}`).join(', ');
            const c = o.customer || {};
            const deliv = c.delivery === 'shipping' ? `🚚 ${c.address || ''}` : '🏬 Retiro en tienda';
            const isFinal = ['pending_approval', 'approved', 'rejected'].includes(o.status);

            return (
              <tr key={o.id}>
                <td>#{o.id.slice(0, 6)}</td>
                <td>
                  {c.name ? (
                    <>
                      <strong>{c.name}</strong><br />
                      <small>{c.phone || ''}</small><br />
                      <small className="muted-note">{deliv}</small>
                    </>
                  ) : <span className="muted-note">—</span>}
                </td>
                <td>{items}</td>
                <td><strong>{money(currency, o.total)}</strong></td>
                <td>
                  {isFinal ? (
                    <span className={`status-pill status-${o.status}`}>{o.status}</span>
                  ) : (
                    <select
                      className={`status-pill status-${o.status}`}
                      value={o.status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </td>
                <td>{formatDate(o.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
