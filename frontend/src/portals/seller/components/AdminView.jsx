import { useState, useMemo } from 'react';

function money(currency, n) { return `${currency}${Number(n || 0).toFixed(2)}`; }

function formatTs(ts) {
  const s = ts?._seconds ?? ts?.seconds;
  return s ? new Date(s * 1000).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function RejectionModal({ order, currency, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const items = order.lines?.map(l => `${l.name} x${l.qty}`).join(', ') || '—';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>❌</div>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Rechazar Venta</h3>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-soft)' }}>
            <strong style={{ color: 'var(--text)' }}>{order.sellerName || order.sellerEmail}</strong> — {items}
            <br /><span style={{ color: 'var(--accent)' }}>{money(currency, order.subtotal)}</span>
          </p>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Motivo del rechazo <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Ej. El producto no coincide con el stock disponible..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancelar</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            style={{ flex: 1, padding: '11px', borderRadius: '20px', border: 'none', background: reason.trim() ? '#ef4444' : 'rgba(239,68,68,0.3)', color: '#fff', fontWeight: 700, cursor: reason.trim() ? 'pointer' : 'not-allowed', fontSize: '14px' }}
          >
            Confirmar Rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminView({ orders, currency, onStatusChange }) {
  const [rejecting, setRejecting] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending_approval'), [orders]);
  const approvedOrders = useMemo(() => orders.filter(o => o.status === 'approved'), [orders]);

  const performanceBySeller = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const key = o.sellerName || o.sellerEmail || 'Desconocido';
      if (!map[key]) map[key] = { name: key, total: 0, approved: 0, pending: 0, rejected: 0, revenue: 0, commission: 0 };
      map[key].total++;
      if (o.status === 'approved') { map[key].approved++; map[key].revenue += Number(o.subtotal) || 0; map[key].commission += Number(o.commissionTotal) || 0; }
      else if (o.status === 'pending_approval') map[key].pending++;
      else if (o.status === 'rejected') map[key].rejected++;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  async function approve(id) {
    setProcessing(id);
    try { await onStatusChange(id, 'approved'); } finally { setProcessing(null); }
  }

  async function reject(order) { setRejecting(order); }

  async function confirmReject(reason) {
    setProcessing(rejecting.id);
    try { await onStatusChange(rejecting.id, 'rejected', reason); } finally { setProcessing(null); setRejecting(null); }
  }

  const thStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', padding: '11px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)' };
  const tdStyle = { padding: '13px 14px', borderBottom: '1px solid var(--border)', fontSize: '13.5px', verticalAlign: 'middle' };

  return (
    <div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Pendientes de Aprobación', value: pendingOrders.length, icon: 'fa-clock', color: '#f59e0b', urgent: pendingOrders.length > 0 },
          { label: 'Ventas Aprobadas', value: approvedOrders.length, icon: 'fa-circle-check', color: '#10b981' },
          { label: 'Ingresos Totales', value: money(currency, approvedOrders.reduce((s, o) => s + (Number(o.subtotal) || 0), 0)), icon: 'fa-money-bill-wave', color: 'var(--accent)' },
          { label: 'Comisiones a Pagar', value: money(currency, approvedOrders.reduce((s, o) => s + (Number(o.commissionTotal) || 0), 0)), icon: 'fa-star', color: '#7c83ff' },
        ].map(k => (
          <div key={k.label} style={{ background: k.urgent ? 'rgba(245,158,11,0.08)' : 'var(--surface)', border: `1px solid ${k.urgent ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`, borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fa-solid ${k.icon}`} style={{ color: k.color, fontSize: '17px' }}></i>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: k.urgent ? k.color : 'var(--heading-color)' }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-soft)', fontWeight: 600 }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Aprobaciones Pendientes ────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: pendingOrders.length > 0 ? '1.5px solid rgba(245,158,11,0.3)' : '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: pendingOrders.length > 0 ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-clock" style={{ color: '#f59e0b' }}></i>
            Aprobaciones Pendientes
            {pendingOrders.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#000', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '20px' }}>
                {pendingOrders.length}
              </span>
            )}
          </h3>
        </div>

        {pendingOrders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: '32px', color: '#10b981' }}></i>
            <p style={{ color: 'var(--text-soft)', marginTop: '10px', fontSize: '14px' }}>No hay ventas pendientes de aprobación.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Pedido</th>
                  <th style={thStyle}>Vendedor</th>
                  <th style={thStyle}>Productos</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map(o => {
                  const items = o.lines?.map(l => `${l.name} x${l.qty}`).join(', ') || '—';
                  const busy = processing === o.id;
                  return (
                    <tr key={o.id}>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(124,131,255,0.12)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '5px', fontWeight: 800 }}>
                          #{o.id?.slice(0, 6)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{o.sellerName || o.sellerEmail || '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: '220px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text-soft)' }}>{items}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{money(currency, o.subtotal)}</td>
                      <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--text-soft)' }}>{formatTs(o.createdAt)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => approve(o.id)}
                            disabled={busy}
                            style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: busy ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            {busy ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                            Aprobar
                          </button>
                          <button
                            onClick={() => reject(o)}
                            disabled={busy}
                            style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <i className="fa-solid fa-xmark"></i> Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Rendimiento por Vendedor ───────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
            <i className="fa-solid fa-ranking-star" style={{ color: 'var(--accent)', marginRight: '8px' }}></i>
            Rendimiento por Vendedor
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Vendedor</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Reportes</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Aprobadas</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Pendientes</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Ingresos</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Comisión</th>
              </tr>
            </thead>
            <tbody>
              {performanceBySeller.length === 0 ? (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>Sin datos de rendimiento.</td></tr>
              ) : performanceBySeller.map(s => (
                <tr key={s.name}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{s.name}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-soft)' }}>{s.total}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>{s.approved}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {s.pending > 0 ? <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>{s.pending}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{money(currency, s.revenue)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{money(currency, s.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Historial Completo (colapsible) ───────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowAll(v => !v)}
          style={{ all: 'unset', display: 'flex', width: '100%', boxSizing: 'border-box', padding: '16px 20px', cursor: 'pointer', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--heading-color)' }}>
            <i className="fa-solid fa-list-ul" style={{ color: 'var(--accent)', marginRight: '8px' }}></i>
            Historial Completo
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>({orders.length} ventas)</span>
          </h3>
          <i className={`fa-solid fa-chevron-${showAll ? 'up' : 'down'}`} style={{ color: 'var(--text-soft)', fontSize: '13px' }}></i>
        </button>
        {showAll && (
          <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Pedido</th>
                  <th style={thStyle}>Vendedor</th>
                  <th style={thStyle}>Productos</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  <th style={thStyle}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const items = o.lines?.map(l => `${l.name} x${l.qty}`).join(', ') || '—';
                  const STATUS_COLORS = { approved: '#10b981', rejected: '#ef4444', pending_approval: '#f59e0b', pending: '#7c83ff', delivered: '#10b981', cancelled: '#ef4444' };
                  const STATUS_LABELS = { approved: 'Aprobada', rejected: 'Rechazada', pending_approval: 'En revisión', pending: 'Pendiente', delivered: 'Entregada', cancelled: 'Cancelada' };
                  const sc = STATUS_COLORS[o.status] || 'var(--muted)';
                  return (
                    <tr key={o.id}>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(124,131,255,0.12)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '5px', fontWeight: 800 }}>#{o.id?.slice(0, 6)}</span></td>
                      <td style={{ ...tdStyle, fontWeight: 700, fontSize: '13px' }}>{o.sellerName || o.sellerEmail || '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: '200px' }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text-soft)' }}>{items}</span></td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{money(currency, o.subtotal)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, color: sc, background: `${sc}18`, textTransform: 'uppercase' }}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--text-soft)' }}>{formatTs(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejecting && (
        <RejectionModal
          order={rejecting}
          currency={currency}
          onConfirm={confirmReject}
          onCancel={() => setRejecting(null)}
        />
      )}
    </div>
  );
}
