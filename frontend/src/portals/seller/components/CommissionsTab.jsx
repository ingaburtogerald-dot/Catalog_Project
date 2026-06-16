function money(currency, n) { return `${currency}${Number(n || 0).toFixed(2)}`; }

function formatDate(ts) {
  const d = ts?._seconds ? new Date(ts._seconds * 1000) : ts?.seconds ? new Date(ts.seconds * 1000) : null;
  return d ? d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function CommissionsTab({ approvedOrders, currency }) {
  const totalCommission = approvedOrders.reduce((sum, o) => sum + (o.commissionTotal || 0), 0);

  return (
    <div className="panel">
      <h2>Historial de Comisiones</h2>
      {approvedOrders.length === 0 ? (
        <p className="muted-note">Todavía no tienes ventas aprobadas.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Fecha aprobación</th>
                <th>Productos</th>
                <th>Subtotal</th>
                <th>Costo real</th>
                <th>Comisión</th>
              </tr>
            </thead>
            <tbody>
              {approvedOrders.map((o) => (
                <tr key={o.id}>
                  <td>{formatDate(o.approvedAt)}</td>
                  <td>{o.lines.map((l) => `${l.name} x${l.qty}`).join(', ')}</td>
                  <td>{money(currency, o.subtotal)}</td>
                  <td>{money(currency, o.realCostTotal)}</td>
                  <td><strong style={{ color: 'var(--accent)' }}>{money(currency, o.commissionTotal)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Total comisión acumulada:</td>
                <td><strong style={{ color: 'var(--accent)' }}>{money(currency, totalCommission)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
