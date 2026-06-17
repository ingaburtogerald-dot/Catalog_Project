import { useState, useMemo } from 'react';
import { groupProducts } from '../utils/grouping';
import ReportSaleModal from './ReportSaleModal';

function formatTs(ts) {
  const s = ts?._seconds ?? ts?.seconds;
  if (!s) return null;
  return new Date(s * 1000);
}

function groupByMonth(orders) {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const map = {};

  orders.forEach(o => {
    const d = formatTs(o.createdAt);
    if (!d) return;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('es-NI', { month: 'long', year: 'numeric' });
    if (!map[ym]) map[ym] = { ym, label, approved: 0, pending: 0, rejected: 0, revenue: 0, commission: 0 };
    if (o.status === 'approved') {
      map[ym].approved++;
      map[ym].revenue += Number(o.subtotal) || 0;
      map[ym].commission += Number(o.commissionTotal) || 0;
    } else if (o.status === 'rejected') {
      map[ym].rejected++;
    } else {
      map[ym].pending++;
    }
  });

  return { months: Object.values(map).sort((a, b) => b.ym.localeCompare(a.ym)), currentYM };
}

const STATUS_LABEL = {
  approved: { label: 'Aprobada', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  rejected: { label: 'Rechazada', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  pending_approval: { label: 'En revisión', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  pending: { label: 'Pendiente', color: '#7c83ff', bg: 'rgba(124,131,255,0.12)' },
  delivered: { label: 'Entregada', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  cancelled: { label: 'Cancelada', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function StatusPill({ status }) {
  const s = STATUS_LABEL[status] || { label: status, color: 'var(--muted)', bg: 'var(--border)' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function MonthCard({ month, maxRevenue, currency, isCurrent }) {
  const barPct = maxRevenue > 0 ? Math.max(3, (month.revenue / maxRevenue) * 100) : 3;
  return (
    <div style={{
      background: isCurrent ? 'rgba(124,131,255,0.07)' : 'var(--surface)',
      border: `1.5px solid ${isCurrent ? 'rgba(124,131,255,0.35)' : 'var(--border)'}`,
      borderRadius: '14px', padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: isCurrent ? 'var(--accent)' : 'var(--text-soft)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isCurrent && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
          {month.label}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>{month.approved} aprobadas</span>
      </div>
      <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', marginBottom: '14px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${barPct}%`, background: isCurrent ? 'var(--accent)' : '#10b981', borderRadius: '3px' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--heading-color)' }}>{currency}{month.revenue.toFixed(2)}</p>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>En ventas</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#10b981' }}>{currency}{month.commission.toFixed(2)}</p>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Comisión</p>
        </div>
      </div>
      {(month.pending > 0 || month.rejected > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
          {month.pending > 0 && <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>⏳ {month.pending} en revisión</span>}
          {month.rejected > 0 && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>✗ {month.rejected} rechazadas</span>}
        </div>
      )}
    </div>
  );
}

export default function SellerView({ user, products, orders, currency, reloadOrders, toast }) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCatalog, setShowCatalog] = useState(false);

  const groupedProducts = useMemo(() => groupProducts(products), [products]);
  const { months, currentYM } = useMemo(() => groupByMonth(orders), [orders]);
  const currentMonth = months.find(m => m.ym === currentYM);
  const maxRevenue = useMemo(() => Math.max(...months.map(m => m.revenue), 1), [months]);
  const recentOrders = useMemo(() => [...orders].sort((a, b) => {
    const ta = a.createdAt?._seconds ?? a.createdAt?.seconds ?? 0;
    const tb = b.createdAt?._seconds ?? b.createdAt?.seconds ?? 0;
    return tb - ta;
  }).slice(0, 10), [orders]);

  const thStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', padding: '11px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)' };
  const tdStyle = { padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13.5px', verticalAlign: 'middle' };

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* ── Encabezado ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--heading-color)' }}>💼 Mis Ventas</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-soft)' }}>Seguimiento de tus reportes y comisiones</p>
        </div>
        <button
          onClick={() => { setSelectedProduct(null); setShowReportModal(true); }}
          className="btn-solid"
          style={{ padding: '11px 22px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className="fa-solid fa-plus"></i> Reportar Venta
        </button>
      </div>

      {/* ── Resumen Mes Actual ──────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(124,131,255,0.12), rgba(124,131,255,0.04))', border: '1.5px solid rgba(124,131,255,0.25)', borderRadius: '18px', padding: '24px 28px', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--accent)' }}>
          <i className="fa-solid fa-calendar-day" style={{ marginRight: '6px' }}></i>
          Mes actual — {new Date().toLocaleString('es-NI', { month: 'long', year: 'numeric' })}
        </p>
        {currentMonth ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
            {[
              { label: 'Ventas Aprobadas', value: currentMonth.approved, icon: 'fa-circle-check', color: '#10b981' },
              { label: 'Total Vendido', value: `${currency}${currentMonth.revenue.toFixed(2)}`, icon: 'fa-money-bill-wave', color: 'var(--accent)' },
              { label: 'Comisión Ganada', value: `${currency}${currentMonth.commission.toFixed(2)}`, icon: 'fa-star', color: '#f59e0b' },
              { label: 'En Revisión', value: currentMonth.pending, icon: 'fa-clock', color: '#7c83ff' },
            ].map(k => (
              <div key={k.label}>
                <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, color: k.color }}>{k.value}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className={`fa-solid ${k.icon}`}></i> {k.label}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-soft)', fontSize: '14px', margin: 0 }}>No hay ventas registradas este mes. ¡Reporta tu primera venta!</p>
        )}
      </div>

      {/* ── Historial por Mes ───────────────────────────────────── */}
      {months.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: 'var(--heading-color)' }}>
            <i className="fa-solid fa-chart-bar" style={{ color: 'var(--accent)', marginRight: '8px' }}></i>
            Historial por Mes
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {months.slice(0, 6).map(m => (
              <MonthCard key={m.ym} month={m} maxRevenue={maxRevenue} currency={currency} isCurrent={m.ym === currentYM} />
            ))}
          </div>
        </div>
      )}

      {/* ── Últimas Ventas ──────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
            <i className="fa-solid fa-list" style={{ color: 'var(--accent)', marginRight: '8px' }}></i>
            Mis Últimas Ventas
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{orders.length} en total</span>
        </div>
        {recentOrders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: '32px', color: 'var(--muted)' }}></i>
            <p style={{ color: 'var(--text-soft)', marginTop: '10px' }}>Aún no has registrado ventas.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Pedido</th>
                  <th style={thStyle}>Productos</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Comisión</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  <th style={thStyle}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => {
                  const items = o.lines?.map(l => `${l.name} x${l.qty}`).join(', ') || '—';
                  const d = formatTs(o.createdAt);
                  return (
                    <tr key={o.id}>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(124,131,255,0.12)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '5px', fontWeight: 800 }}>
                          #{o.id?.slice(0, 6)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: '200px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text-soft)' }}>{items}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{currency}{Number(o.subtotal || o.total || 0).toFixed(2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                        {o.commissionTotal ? `${currency}${Number(o.commissionTotal).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><StatusPill status={o.status} /></td>
                      <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--text-soft)' }}>
                        {d ? d.toLocaleDateString('es-NI') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Catálogo Disponible (colapsible) ────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowCatalog(v => !v)}
          style={{ all: 'unset', display: 'flex', width: '100%', boxSizing: 'border-box', padding: '16px 20px', cursor: 'pointer', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--heading-color)' }}>
            <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--accent)', marginRight: '8px' }}></i>
            Catálogo Disponible
          </h3>
          <i className={`fa-solid fa-chevron-${showCatalog ? 'up' : 'down'}`} style={{ color: 'var(--text-soft)', fontSize: '13px' }}></i>
        </button>

        {showCatalog && (
          <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
            {groupedProducts.length === 0 ? (
              <p style={{ color: 'var(--text-soft)', padding: '20px 0', textAlign: 'center', fontSize: '14px' }}>No hay productos en el inventario.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginTop: '16px' }}>
                {groupedProducts.map(group => (
                  <div key={group.baseName} style={{ background: 'var(--bg-color, #0b0f19)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--heading-color)', lineHeight: '1.3' }}>{group.baseName}</h4>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{currency}{Number(group.price).toFixed(2)}</span>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {group.variants.map((v, i) => (
                        <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-soft)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                          <span>{v.variantName}</span>
                          <strong style={{ color: v.stock > 0 ? '#10b981' : '#ef4444' }}>{v.stock || 0}</strong>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => { setSelectedProduct(group); setShowReportModal(true); }}
                      className="btn-solid"
                      style={{ padding: '8px', fontSize: '13px', marginTop: '4px' }}
                    >
                      <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> Vender
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showReportModal && (
        <ReportSaleModal
          user={user}
          groupedProducts={groupedProducts}
          preselectedProduct={selectedProduct}
          currency={currency}
          toast={toast}
          onClose={() => { setShowReportModal(false); setSelectedProduct(null); }}
          onSuccess={() => { setShowReportModal(false); setSelectedProduct(null); reloadOrders(); toast('✅ Reporte enviado a revisión'); }}
        />
      )}
    </div>
  );
}
