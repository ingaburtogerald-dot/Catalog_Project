import { useCallback, useEffect, useMemo, useState } from 'react';
import PortalLayout from '../layout/PortalLayout';
import { authedFetch } from '../lib/portalApi';
import { usePortalToast } from '../../hooks/usePortalToast';

const STATUSES = [
  { id: 'compra_china',       label: 'Compra en China',       color: '#7c83ff', icon: 'fa-cart-shopping' },
  { id: 'en_transito',        label: 'En Tránsito',           color: '#f59e0b', icon: 'fa-ship' },
  { id: 'recibido_china',     label: 'Recibido en China',     color: '#10b981', icon: 'fa-warehouse' },
  { id: 'recibido_nicaragua', label: 'Recibido en Nicaragua', color: '#22c55e', icon: 'fa-flag' },
  { id: 'entregado',          label: 'Entregado',             color: '#10b981', icon: 'fa-circle-check' },
];

function statusInfo(id) {
  return STATUSES.find(s => s.id === id) || { label: id, color: 'var(--muted)', icon: 'fa-circle' };
}

function formatTs(ts) {
  const s = ts?._seconds ?? ts?.seconds;
  return s ? new Date(s * 1000).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

// ─── Status Stepper (for customer cards) ──────────────────────────────────────
function StatusStepper({ currentStatus }) {
  const currentIdx = STATUSES.findIndex(s => s.id === currentStatus);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: '12px', overflowX: 'auto' }}>
      {STATUSES.map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STATUSES.length - 1 ? 1 : 'none', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '54px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                background: done ? s.color : 'var(--border)', color: done ? '#fff' : 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
                outline: active ? `3px solid ${s.color}40` : 'none',
                outlineOffset: '2px', transition: 'all 0.3s',
              }}>
                <i className={`fa-solid ${s.icon}`}></i>
              </div>
              <span style={{ fontSize: '9px', fontWeight: active ? 800 : 600, color: done ? s.color : 'var(--muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: '54px' }}>{s.label}</span>
            </div>
            {i < STATUSES.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: i < currentIdx ? s.color : 'var(--border)', margin: '0 2px', marginBottom: '18px', minWidth: '8px' }}></div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── AdvanceStatusModal (for admin) ───────────────────────────────────────────
function AdvanceStatusModal({ pkg, onConfirm, onCancel }) {
  const currentIdx = STATUSES.findIndex(s => s.id === pkg.status);
  const nextStatus = STATUSES[currentIdx + 1];
  const [comment, setComment] = useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', maxWidth: '420px', width: '100%' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700 }}>Avanzar Estado del Paquete</h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-soft)' }}>
          <strong style={{ color: 'var(--text)' }}>{pkg.description || pkg.id}</strong>
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px', background: 'var(--bg)', borderRadius: '10px' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Actual</p>
            <span style={{ fontSize: '12px', fontWeight: 800, color: statusInfo(pkg.status).color }}>{statusInfo(pkg.status).label}</span>
          </div>
          <i className="fa-solid fa-arrow-right" style={{ color: 'var(--muted)', fontSize: '16px' }}></i>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Nuevo</p>
            <span style={{ fontSize: '12px', fontWeight: 800, color: nextStatus ? statusInfo(nextStatus.id).color : '#10b981' }}>
              {nextStatus?.label || 'Entregado'}
            </span>
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comentario (opcional)</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Ej. Llegó al puerto de Shanghai, documentos en orden..." style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancelar</button>
          <button onClick={() => onConfirm(nextStatus?.id || 'entregado', comment)} style={{ flex: 1, padding: '11px', borderRadius: '20px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CreatePackageModal ────────────────────────────────────────────────────────
function CreatePackageModal({ onConfirm, onCancel }) {
  const [form, setForm] = useState({ customerEmail: '', description: '', trackingCode: '', estimatedArrival: '', status: 'compra_china' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.customerEmail.trim() && form.description.trim();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', maxWidth: '460px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: 700 }}>Registrar Nuevo Paquete</h3>
        {[
          { label: 'Email del cliente *', key: 'customerEmail', type: 'email', placeholder: 'cliente@email.com' },
          { label: 'Descripción *', key: 'description', type: 'text', placeholder: 'Ej. Cargamento de ropa / Electrónicos' },
          { label: 'Código de rastreo', key: 'trackingCode', type: 'text', placeholder: 'Ej. CN1234567890' },
          { label: 'Llegada estimada', key: 'estimatedArrival', type: 'date', placeholder: '' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</label>
            <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '14px' }} />
          </div>
        ))}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estado inicial</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '14px' }}>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancelar</button>
          <button onClick={() => valid && onConfirm(form)} disabled={!valid} style={{ flex: 1, padding: '11px', borderRadius: '20px', border: 'none', background: valid ? 'var(--accent)' : 'rgba(124,131,255,0.3)', color: '#fff', fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed', fontSize: '14px' }}>
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AdminLogisticsView ────────────────────────────────────────────────────────
function AdminLogisticsView({ packages, currency, onAdvance, onCreate }) {
  const [advancing, setAdvancing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [processing, setProcessing] = useState(null);

  const filtered = useMemo(() => packages.filter(p => {
    const matchSearch = !search || p.description?.toLowerCase().includes(search.toLowerCase()) || p.customerEmail?.toLowerCase().includes(search.toLowerCase()) || p.trackingCode?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  }), [packages, search, filterStatus]);

  const countByStatus = useMemo(() => {
    const m = { all: packages.length };
    STATUSES.forEach(s => { m[s.id] = packages.filter(p => p.status === s.id).length; });
    return m;
  }, [packages]);

  async function handleAdvance(pkg) { setAdvancing(pkg); }

  async function confirmAdvance(nextStatus, comment) {
    setProcessing(advancing.id);
    try { await onAdvance(advancing.id, nextStatus, comment); } finally { setProcessing(null); setAdvancing(null); }
  }

  async function handleCreate(data) {
    await onCreate(data);
    setShowCreate(false);
  }

  const thStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', padding: '11px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)' };
  const tdStyle = { padding: '13px 14px', borderBottom: '1px solid var(--border)', fontSize: '13.5px', verticalAlign: 'middle' };

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total Paquetes', value: packages.length, color: 'var(--accent)', icon: 'fa-box' },
          { label: 'En Tránsito', value: (countByStatus['compra_china'] || 0) + (countByStatus['en_transito'] || 0) + (countByStatus['recibido_china'] || 0), color: '#f59e0b', icon: 'fa-ship' },
          { label: 'En Nicaragua', value: countByStatus['recibido_nicaragua'] || 0, color: '#10b981', icon: 'fa-flag' },
          { label: 'Entregados', value: countByStatus['entregado'] || 0, color: '#22c55e', icon: 'fa-circle-check' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fa-solid ${k.icon}`} style={{ color: k.color, fontSize: '16px' }}></i>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-soft)', fontWeight: 600 }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + actions */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente, descripción o tracking..." style={{ flex: 1, minWidth: '200px', padding: '9px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '14px' }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '9px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '13px' }}>
            <option value="all">Todos ({packages.length})</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label} ({countByStatus[s.id] || 0})</option>)}
          </select>
          <button onClick={() => setShowCreate(true)} style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
            <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> Nuevo Paquete
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Cliente</th>
                <th style={thStyle}>Descripción</th>
                <th style={thStyle}>Tracking</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Fecha</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>Sin resultados.</td></tr>
              ) : filtered.map(p => {
                const si = statusInfo(p.status);
                const currentIdx = STATUSES.findIndex(s => s.id === p.status);
                const isFinal = currentIdx >= STATUSES.length - 1;
                const busy = processing === p.id;
                return (
                  <tr key={p.id}>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(124,131,255,0.12)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '5px', fontWeight: 800 }}>#{p.id?.slice(0, 6)}</span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '13px' }}>
                      <span style={{ fontWeight: 700 }}>{p.customerName || p.customerEmail}</span>
                      {p.customerName && <br />}
                      {p.customerName && <span style={{ fontSize: '11px', color: 'var(--text-soft)' }}>{p.customerEmail}</span>}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: '180px' }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '—'}</span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-soft)' }}>{p.trackingCode || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, color: si.color, background: `${si.color}18`, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        <i className={`fa-solid ${si.icon}`} style={{ marginRight: '4px' }}></i>{si.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--text-soft)' }}>{formatTs(p.createdAt)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {!isFinal ? (
                        <button onClick={() => handleAdvance(p)} disabled={busy} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: busy ? 'rgba(124,131,255,0.2)' : 'rgba(124,131,255,0.15)', color: 'var(--accent)', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                          {busy ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-arrow-right"></i>}
                          Avanzar
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✓ Completado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {advancing && <AdvanceStatusModal pkg={advancing} onConfirm={confirmAdvance} onCancel={() => setAdvancing(null)} />}
      {showCreate && <CreatePackageModal onConfirm={handleCreate} onCancel={() => setShowCreate(false)} />}
    </div>
  );
}

// ─── CustomerLogisticsView ─────────────────────────────────────────────────────
function CustomerLogisticsView({ packages }) {
  if (packages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <i className="fa-solid fa-box-open" style={{ fontSize: '48px', color: 'var(--muted)', marginBottom: '16px', display: 'block' }}></i>
        <h3 style={{ color: 'var(--heading-color)', marginBottom: '8px' }}>No tienes paquetes registrados</h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '14px' }}>Cuando se registre un envío a tu nombre, aparecerá aquí con su estado en tiempo real.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--text-soft)', marginBottom: '20px', fontSize: '14px' }}>
        Tienes <strong style={{ color: 'var(--text)' }}>{packages.length} {packages.length === 1 ? 'paquete' : 'paquetes'}</strong> registrados.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {packages.map(p => {
          const si = statusInfo(p.status);
          const isFinal = p.status === 'entregado';
          return (
            <div key={p.id} style={{ background: 'var(--surface)', border: `1px solid ${isFinal ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: '16px', padding: '20px 24px', boxShadow: isFinal ? '0 0 0 1px rgba(34,197,94,0.1)' : 'none' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{p.description || 'Paquete sin descripción'}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {p.trackingCode && <><i className="fa-solid fa-barcode"></i> <span style={{ fontFamily: 'monospace' }}>{p.trackingCode}</span></>}
                    {p.estimatedArrival && <><i className="fa-solid fa-calendar"></i> Llega: <strong>{p.estimatedArrival}</strong></>}
                  </p>
                </div>
                <span style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, color: si.color, background: `${si.color}18`, border: `1px solid ${si.color}30`, whiteSpace: 'nowrap' }}>
                  <i className={`fa-solid ${si.icon}`} style={{ marginRight: '5px' }}></i>{si.label}
                </span>
              </div>

              {/* Stepper */}
              <StatusStepper currentStatus={p.status} />

              {/* Last comment */}
              {p.lastComment && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--bg)', borderRadius: '10px', borderLeft: `3px solid ${si.color}` }}>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-soft)', fontStyle: 'italic' }}>
                    <i className="fa-solid fa-comment" style={{ marginRight: '6px', color: si.color }}></i>
                    {p.lastComment}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function GyroLogistics({ user, signOutPortal }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, toastMsg, toastShow } = usePortalToast();

  const isAdmin = user.roles && (user.roles.includes('admin') || user.roles.includes('global_admin') || user.roles.includes('logistics_admin'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedFetch('/logistics', user);
      setPackages(Array.isArray(data) ? data : []);
    } catch (err) {
      toast(`Error al cargar paquetes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleAdvance(id, nextStatus, comment) {
    try {
      await authedFetch(`/logistics/${id}`, user, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, ...(comment ? { comment } : {}) }),
      });
      toast(`Paquete actualizado a: ${statusInfo(nextStatus).label}`);
      await load();
    } catch (err) {
      toast(`Error: ${err.message}`);
      throw err;
    }
  }

  async function handleCreate(data) {
    try {
      await authedFetch('/logistics', user, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      toast('Paquete registrado exitosamente.');
      await load();
    } catch (err) {
      toast(`Error: ${err.message}`);
      throw err;
    }
  }

  return (
    <PortalLayout
      title="Gyro Logistics"
      icon="📦"
      user={user}
      signOutPortal={signOutPortal}
      currentPortal="logistics"
    >
      <div className={`toast ${toastShow ? 'show' : ''}`}>{toastMsg}</div>

      <div className="portal-theme">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '12px', color: 'var(--text-soft)' }}>
            <i className="fa-solid fa-circle-notch fa-spin fa-xl" style={{ color: 'var(--accent)' }}></i>
            <span>Cargando paquetes...</span>
          </div>
        ) : isAdmin ? (
          <AdminLogisticsView packages={packages} onAdvance={handleAdvance} onCreate={handleCreate} />
        ) : (
          <CustomerLogisticsView packages={packages} />
        )}
      </div>
    </PortalLayout>
  );
}
