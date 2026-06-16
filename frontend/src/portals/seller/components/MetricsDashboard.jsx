function money(currency, n) { return `${currency}${Number(n || 0).toFixed(2)}`; }

function getMillis(ts) {
  if (ts?._seconds) return ts._seconds * 1000;
  if (ts?.seconds) return ts.seconds * 1000;
  return 0;
}

export default function MetricsDashboard({ orders, currency }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const approved = orders.filter((o) => o.status === 'approved');
  const approvedThisMonth = approved.filter((o) => getMillis(o.approvedAt) >= monthStart);

  const salesThisMonth = approvedThisMonth.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const commissionThisMonth = approvedThisMonth.reduce((sum, o) => sum + (o.commissionTotal || 0), 0);
  const avgTicket = approvedThisMonth.length ? salesThisMonth / approvedThisMonth.length : 0;
  const pendingCount = orders.filter((o) => o.status === 'pending_approval').length;

  const cards = [
    { label: 'Ventas del mes', value: money(currency, salesThisMonth) },
    { label: 'Comisión del mes', value: money(currency, commissionThisMonth) },
    { label: 'Ticket promedio', value: money(currency, avgTicket) },
    { label: 'Pendientes de aprobación', value: pendingCount },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c) => (
        <div key={c.label} className="kpi-card">
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
