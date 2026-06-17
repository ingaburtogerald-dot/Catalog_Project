import { useCallback, useEffect, useMemo, useState } from 'react';
import PortalLayout from '../layout/PortalLayout';
import { authedFetch } from '../lib/portalApi';

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function money(currency, n) { return `${currency}${Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function formatTs(ts) {
  const s = ts?._seconds ?? ts?.seconds;
  return s ? new Date(s * 1000).toLocaleDateString('es-NI', { day: '2-digit', month: 'short' }) : '—';
}

// ─── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, currency, color = 'var(--accent)' }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100px', padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700 }}>
            {d.value > 0 ? (d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value) : ''}
          </span>
          <div title={`${d.label}: ${money(currency, d.value)}`} style={{
            width: '100%', borderRadius: '4px 4px 0 0',
            height: `${Math.max((d.value / max) * 80, d.value > 0 ? 4 : 0)}px`,
            background: d.highlight ? color : `${color}55`,
            transition: 'height 0.5s ease',
            cursor: 'default',
          }}></div>
          <span style={{ fontSize: '9px', color: d.highlight ? 'var(--text)' : 'var(--muted)', fontWeight: d.highlight ? 800 : 600 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color, trend }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fa-solid ${icon}`} style={{ color, fontSize: '16px' }}></i>
        </div>
        {trend !== undefined && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</p>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-soft)', fontWeight: 600 }}>{label}</p>
        {sub && <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ title, icon, color = 'var(--accent)', children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className={`fa-solid ${icon}`} style={{ color, fontSize: '15px' }}></i>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{title}</h3>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Reports({ user, signOutPortal }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [currency, setCurrency] = useState('C$');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6m');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ords, prods, cfg] = await Promise.all([
        authedFetch('/orders', user),
        authedFetch('/products?all=true', user),
        authedFetch('/config', user).catch(() => ({ currency: 'C$' })),
      ]);
      setOrders(Array.isArray(ords) ? ords : []);
      setProducts(Array.isArray(prods) ? prods : []);
      setCurrency(cfg?.currency || 'C$');
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const approvedOrders = useMemo(() => orders.filter(o => o.status === 'approved' || o.status === 'delivered'), [orders]);

  // Monthly revenue for bar chart
  const monthlyData = useMemo(() => {
    const months = period === '12m' ? 12 : 6;
    const now = new Date();
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthOrders = approvedOrders.filter(o => {
        const s = o.createdAt?._seconds ?? o.createdAt?.seconds;
        if (!s) return false;
        const od = new Date(s * 1000);
        return `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, '0')}` === ym;
      });
      result.push({ label: MONTHS_ES[d.getMonth()], value: monthOrders.reduce((s, o) => s + (Number(o.subtotal) || 0), 0), highlight: i === 0 });
    }
    return result;
  }, [approvedOrders, period]);

  // Top products
  const topProducts = useMemo(() => {
    const map = {};
    approvedOrders.forEach(o => o.lines?.forEach(l => {
      if (!map[l.name]) map[l.name] = { name: l.name, qty: 0, revenue: 0 };
      map[l.name].qty += l.qty || 1;
      map[l.name].revenue += (l.price || 0) * (l.qty || 1);
    }));
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [approvedOrders]);

  // Top sellers
  const topSellers = useMemo(() => {
    const map = {};
    approvedOrders.forEach(o => {
      const key = o.sellerName || o.sellerEmail || 'Desconocido';
      if (!map[key]) map[key] = { name: key, count: 0, revenue: 0, commission: 0 };
      map[key].count++;
      map[key].revenue += Number(o.subtotal) || 0;
      map[key].commission += Number(o.commissionTotal) || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [approvedOrders]);

  // Status breakdown for donut-like chart
  const statusBreakdown = useMemo(() => {
    const total = orders.length || 1;
    const counts = { approved: 0, pending_approval: 0, rejected: 0, delivered: 0, other: 0 };
    orders.forEach(o => {
      if (counts[o.status] !== undefined) counts[o.status]++;
      else counts.other++;
    });
    return [
      { label: 'Aprobadas', count: counts.approved + counts.delivered, color: '#10b981' },
      { label: 'En revisión', count: counts.pending_approval, color: '#f59e0b' },
      { label: 'Rechazadas', count: counts.rejected, color: '#ef4444' },
      { label: 'Otras', count: counts.other, color: 'var(--muted)' },
    ].filter(s => s.count > 0).map(s => ({ ...s, pct: ((s.count / total) * 100).toFixed(1) }));
  }, [orders]);

  const totalRevenue = approvedOrders.reduce((s, o) => s + (Number(o.subtotal) || 0), 0);
  const totalCommissions = approvedOrders.reduce((s, o) => s + (Number(o.commissionTotal) || 0), 0);
  const totalStock = products.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const lowStock = products.filter(p => (p.stock || 0) <= 10 && (p.stock || 0) > 0).length;

  if (loading) {
    return (
      <PortalLayout title="Reportes" icon="📊" user={user} signOutPortal={signOutPortal} currentPortal="reportes">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '12px', color: 'var(--text-soft)' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-xl" style={{ color: 'var(--accent)' }}></i>
          <span>Generando reportes...</span>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Reportes" icon="📊" user={user} signOutPortal={signOutPortal} currentPortal="reportes">
      <div className="portal-theme" style={{ maxWidth: '1200px' }}>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <KpiCard label="Ingresos Totales" value={money(currency, totalRevenue)} icon="fa-money-bill-wave" color="var(--accent)" sub={`${approvedOrders.length} ventas aprobadas`} />
          <KpiCard label="Comisiones Pagadas" value={money(currency, totalCommissions)} icon="fa-star" color="#7c83ff" sub={`${((totalCommissions / (totalRevenue || 1)) * 100).toFixed(1)}% del total`} />
          <KpiCard label="Ventas Pendientes" value={orders.filter(o => o.status === 'pending_approval').length} icon="fa-clock" color="#f59e0b" sub="En revisión" />
          <KpiCard label="Productos en Stock" value={totalStock.toLocaleString()} icon="fa-box" color="#10b981" sub={`${lowStock} con stock bajo`} />
          <KpiCard label="Productos Activos" value={products.length} icon="fa-tags" color="#0ea5e9" sub={`${products.filter(p => !p.stock || p.stock === 0).length} sin stock`} />
        </div>

        {/* Revenue Chart + Status Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginBottom: '16px', alignItems: 'start' }}>
          <SectionCard title="Ingresos Mensuales" icon="fa-chart-bar" color="var(--accent)">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', gap: '6px' }}>
              {['6m', '12m'].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ padding: '4px 12px', borderRadius: '20px', border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`, background: period === p ? 'rgba(124,131,255,0.1)' : 'transparent', color: period === p ? 'var(--accent)' : 'var(--text-soft)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {p === '6m' ? 'Últimos 6 meses' : 'Últimos 12 meses'}
                </button>
              ))}
            </div>
            <BarChart data={monthlyData} currency={currency} color="var(--accent)" />
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--muted)', textAlign: 'right' }}>
              El mes actual se muestra resaltado.
            </p>
          </SectionCard>

          <SectionCard title="Estado de Ventas" icon="fa-pie-chart" color="#7c83ff">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '180px' }}>
              {statusBreakdown.map(s => (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{s.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: s.color }}>{s.count} ({s.pct}%)</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: '3px' }}></div>
                  </div>
                </div>
              ))}
              {statusBreakdown.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>Sin datos.</p>}
            </div>
          </SectionCard>
        </div>

        {/* Top Products + Top Sellers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <SectionCard title="Top 5 Productos" icon="fa-fire" color="#f59e0b">
            {topProducts.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>Sin datos de ventas aún.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topProducts.map((p, i) => {
                  const maxRev = topProducts[0].revenue || 1;
                  return (
                    <div key={p.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: i === 0 ? '#f59e0b' : 'var(--muted)', width: '16px', flexShrink: 0 }}>#{i + 1}</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 800, flexShrink: 0, marginLeft: '8px' }}>{money(currency, p.revenue)}</span>
                      </div>
                      <div style={{ height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(p.revenue / maxRev) * 100}%`, background: i === 0 ? '#f59e0b' : 'rgba(124,131,255,0.5)', borderRadius: '3px' }}></div>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>{p.qty} unidades vendidas</p>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Top 5 Vendedores" icon="fa-ranking-star" color="#7c83ff">
            {topSellers.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>Sin datos de ventas aún.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topSellers.map((s, i) => {
                  const maxRev = topSellers[0].revenue || 1;
                  return (
                    <div key={s.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: i === 0 ? '#7c83ff' : 'var(--muted)', width: '16px', flexShrink: 0 }}>#{i + 1}</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 800, flexShrink: 0, marginLeft: '8px' }}>{money(currency, s.revenue)}</span>
                      </div>
                      <div style={{ height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(s.revenue / maxRev) * 100}%`, background: i === 0 ? '#7c83ff' : 'rgba(124,131,255,0.4)', borderRadius: '3px' }}></div>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>{s.count} ventas · comisión {money(currency, s.commission)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Stock Alert Table */}
        <SectionCard title="Alertas de Inventario" icon="fa-triangle-exclamation" color="#f59e0b">
          {lowStock === 0 && products.filter(p => !p.stock || p.stock === 0).length === 0 ? (
            <p style={{ color: '#10b981', fontSize: '13px', margin: 0, fontWeight: 700 }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>Todo el inventario está en buen estado.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Producto', 'Categoría', 'Stock', 'Estado'].map(h => (
                      <th key={h} style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.filter(p => (p.stock || 0) <= 10).sort((a, b) => (a.stock || 0) - (b.stock || 0)).slice(0, 10).map(p => {
                    const isOut = !p.stock || p.stock === 0;
                    return (
                      <tr key={p.id || p.name}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '13px' }}>{p.name}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-soft)' }}>{p.category || '—'}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontWeight: 800, color: isOut ? '#ef4444' : '#f59e0b', fontSize: '13px' }}>{p.stock || 0}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, color: isOut ? '#ef4444' : '#f59e0b', background: isOut ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)' }}>
                            {isOut ? 'Sin Stock' : 'Stock Bajo'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </PortalLayout>
  );
}
