import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PortalLayout from '../layout/PortalLayout';
import { authedFetch } from '../lib/portalApi';
import { fetchConfig } from '../../lib/api';

// ─── Constantes del flujo ────────────────────────────────────────────────────
const EXCHANGE_RATE = 37; // C$ por USD

// Estados de un ítem dentro del flujo de compra internacional:
//   'china'    → registrado en China (Pestaña 1)
//   'pending'  → reportado como recibido en Nicaragua, pendiente de aprobar (2.A)
//   'received' → aprobado, en bodega listo para vender (2.B)

// ─── Lógica de márgenes y precio sugerido ────────────────────────────────────
function getMargin(costoReal) {
  if (costoReal < 100) return 0.75;
  if (costoReal <= 300) return 0.55;
  if (costoReal <= 500) return 0.50;
  if (costoReal <= 800) return 0.45;
  if (costoReal <= 1200) return 0.40;
  return 0.35;
}

// Calcula todas las columnas derivadas de la tabla de Bodega.
function computeWarehouse(item) {
  const qtyIn = Number(item.qty) || 0;
  const salidas = Number(item.salidas) || 0;
  const stock = qtyIn - salidas;
  const totalUSD = (Number(item.costUnit) || 0) + (Number(item.taxUnit) || 0);
  const shippingUnit = Number(item.shippingUnit) || 0;
  const costoReal = (totalUSD + shippingUnit) * EXCHANGE_RATE;
  const margin = getMargin(costoReal);
  // Precio de venta = Costo / (1 - Margen), redondeado HACIA ARRIBA a la decena.
  const precioSugerido = Math.ceil((costoReal / (1 - margin)) / 10) * 10;
  const ganancia = precioSugerido - costoReal;
  return { qtyIn, salidas, stock, totalUSD, shippingUnit, costoReal, margin, precioSugerido, ganancia };
}

// ─── Formatos ────────────────────────────────────────────────────────────────
const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const usd4 = (n) => `$${(Number(n) || 0).toFixed(4)}`; // impuesto unitario con 4 decimales
const cor = (n) => `C$${(Number(n) || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const corInt = (n) => `C$${Math.round(Number(n) || 0).toLocaleString('es-NI')}`;
const fmtDate = (s) => { if (!s) return '—'; const [y, m, d] = String(s).split('-'); return (y && m && d) ? `${d}/${m}/${y}` : String(s); };
// Días entre dos fechas 'YYYY-MM-DD' (Fecha de Compra → Fecha de Ingreso).
const daysBetween = (start, end) => {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00`), e = new Date(`${end}T00:00:00`);
  if (isNaN(s) || isNaN(e)) return null;
  return Math.round((e - s) / 86400000);
};

// ─── Estilos compartidos ─────────────────────────────────────────────────────
const thStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '13.5px', verticalAlign: 'middle', whiteSpace: 'nowrap' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '13.5px', boxSizing: 'border-box' };
const labelStyle = { fontSize: '11px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' };
const panelStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' };

// Metadatos de cada estado del flujo China → Nicaragua → Bodega.
const STATUS_META = {
  china:    { label: 'En China',              color: '#7c83ff', icon: 'fa-plane-departure' },
  pending:  { label: 'Pendiente de aprobar',  color: '#f59e0b', icon: 'fa-clock' },
  received: { label: 'Recibido',              color: '#10b981', icon: 'fa-circle-check' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.china;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 11px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', background: `${m.color}1f`, color: m.color, border: `1px solid ${m.color}40`, whiteSpace: 'nowrap' }}>
      <i className={`fa-solid ${m.icon}`}></i> {m.label}
    </span>
  );
}

function CodePill({ children, color = 'var(--accent)' }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', background: `${color}26`, color, borderRadius: '6px', fontSize: '12px', fontWeight: 800, fontFamily: 'monospace' }}>
      {children || '—'}
    </span>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ padding: '54px 20px', textAlign: 'center' }}>
      <i className={`fa-solid ${icon}`} style={{ fontSize: '34px', color: 'var(--muted)' }}></i>
      <p style={{ color: 'var(--text-soft)', marginTop: '12px', fontSize: '14.5px' }}>{text}</p>
    </div>
  );
}

// ═══ PESTAÑA 1: Registro de compras en China ═════════════════════════════════
function ChinaTab({ items, onAdd, onReport, onEdit }) {
  const EMPTY = { purchaseDate: '', lote: '', code: '', name: '', qty: '', costUnit: '', taxUnit: '' };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const filled = (v) => String(v).trim() !== '';
  const valid = filled(form.purchaseDate) && filled(form.lote) && filled(form.code) && filled(form.name)
    && Number(form.qty) > 0 && filled(form.costUnit) && filled(form.taxUnit);

  // Filtro por rango de fecha de compra ('YYYY-MM-DD' permite comparar como string).
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const filtered = useMemo(() => items.filter(it => {
    const d = it.purchaseDate || '';
    if (desde && (!d || d < desde)) return false;
    if (hasta && (!d || d > hasta)) return false;
    return true;
  }), [items, desde, hasta]);

  // Desglose por lote (sobre el set filtrado): costo de cada LT.
  const byLote = useMemo(() => {
    const m = {};
    filtered.forEach(it => {
      const key = it.lote || '—';
      const q = Number(it.qty) || 0;
      if (!m[key]) m[key] = { lote: key, qty: 0, cost: 0, tax: 0 };
      m[key].qty += q;
      m[key].cost += (Number(it.costUnit) || 0) * q;
      m[key].tax += (Number(it.taxUnit) || 0) * q;
    });
    return Object.values(m).sort((a, b) => String(a.lote).localeCompare(String(b.lote), undefined, { numeric: true }));
  }, [filtered]);

  // Totales y conteos del set filtrado.
  const totalQty = filtered.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const totalCost = filtered.reduce((s, it) => s + (Number(it.costUnit) || 0) * (Number(it.qty) || 0), 0);
  const totalTax = filtered.reduce((s, it) => s + (Number(it.taxUnit) || 0) * (Number(it.qty) || 0), 0);
  const totalPaid = totalCost + totalTax;
  const countChina = filtered.filter(i => i.status === 'china').length;
  const countPending = filtered.filter(i => i.status === 'pending').length;
  const countReceived = filtered.filter(i => i.status === 'received').length;

  async function submit(e) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onAdd({ ...form });
      setForm(EMPTY);
    } catch {
      /* el componente padre ya mostró el toast de error; conservamos el formulario */
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Formulario de ingreso */}
      <form onSubmit={submit} style={{ ...panelStyle, padding: '18px 20px', marginBottom: '18px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--heading-color)' }}>
          <i className="fa-solid fa-cart-plus" style={{ color: 'var(--accent)' }}></i> Registrar compra en China
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Fecha de compra</label>
            <input style={inputStyle} type="date" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Lote</label>
            <input style={inputStyle} value={form.lote} onChange={e => set('lote', e.target.value)} placeholder="Ej. LT1" />
          </div>
          <div>
            <label style={labelStyle}>Código</label>
            <input style={inputStyle} value={form.code} onChange={e => set('code', e.target.value)} placeholder="Ej. IN1" />
          </div>
          <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
            <label style={labelStyle}>Nombre del producto</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. KZ Castor Pro" />
          </div>
          <div>
            <label style={labelStyle}>Cantidad</label>
            <input style={inputStyle} type="number" min="1" step="1" value={form.qty} onChange={e => set('qty', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={labelStyle}>Costo Unit. (USD)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.costUnit} onChange={e => set('costUnit', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={labelStyle}>Impuesto Unit. (USD)</label>
            <input style={inputStyle} type="number" min="0" step="0.0001" value={form.taxUnit} onChange={e => set('taxUnit', e.target.value)} placeholder="0.0000" />
          </div>
          <button type="submit" className="btn-solid" disabled={!valid || saving} style={{ padding: '10px 16px', fontSize: '13.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap', opacity: (valid && !saving) ? 1 : 0.5, cursor: (valid && !saving) ? 'pointer' : 'not-allowed' }}>
            {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Registrando...</> : <><i className="fa-solid fa-plus"></i> Registrar compra</>}
          </button>
        </div>
      </form>

      {/* Tabla de compras en China (registro maestro: muestra TODOS los ítems) */}
      <div style={panelStyle}>
        {items.length === 0 ? (
          <EmptyState icon="fa-plane-departure" text="No hay compras registradas. Agregá la primera con el formulario de arriba." />
        ) : (
          <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha compra</th>
                  <th style={thStyle}>Lote</th>
                  <th style={thStyle}>Código</th>
                  <th style={thStyle}>Producto</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cantidad</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Costo Unit.</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Impuesto Unit.</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Precio Unit. Real</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Acción / Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const total = (Number(it.costUnit) || 0) + (Number(it.taxUnit) || 0);
                  return (
                    <tr key={it.id}>
                      <td style={{ ...tdStyle, color: 'var(--text-soft)' }}>{fmtDate(it.purchaseDate)}</td>
                      <td style={tdStyle}><CodePill color="#f59e0b">{it.lote}</CodePill></td>
                      <td style={tdStyle}><CodePill>{it.code}</CodePill></td>
                      <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: 'normal' }}>{it.name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(it.qty) || 0}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{usd(it.costUnit)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{usd4(it.taxUnit)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>{usd(total)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            title="Editar compra" onClick={() => onEdit(it)}
                            style={{ padding: '6px 9px', borderRadius: '7px', cursor: 'pointer', background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-soft)', fontSize: '12.5px' }}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          {it.status === 'china' ? (
                            <button
                              onClick={() => onReport(it.id)}
                              style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', fontSize: '12.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}
                            >
                              <i className="fa-solid fa-flag-checkered"></i> Reportar como recibido en Nicaragua
                            </button>
                          ) : (
                            <StatusBadge status={it.status} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pie de totales agregados */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '18px 30px', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            {[
              { label: 'Unidades compradas', value: totalQty, color: 'var(--text)', big: false },
              { label: 'Subtotal (sin imp.)', value: usd(totalCost), color: 'var(--text)', big: false },
              { label: 'Impuestos pagados', value: usd(totalTax), color: '#f59e0b', big: false },
              { label: 'Total (con imp.)', value: usd(totalPaid), color: 'var(--accent)', big: true },
              { label: 'Ítems en tránsito', value: countChina, color: '#7c83ff', big: false },
              { label: 'Ítems pendientes', value: countPending, color: '#f59e0b', big: false },
              { label: 'Ítems recibidos', value: countReceived, color: '#10b981', big: false },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)', marginBottom: '3px' }}>{s.label}</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </>
  );
}

// ═══ SUB-PESTAÑA 2.A: Pendiente de aprobar ═══════════════════════════════════
function PendingSubTab({ items, onApprove }) {
  if (items.length === 0) {
    return <div style={panelStyle}><EmptyState icon="fa-clock" text="No hay ítems pendientes de aprobar. Reportalos desde el Tab de compras en China." /></div>;
  }
  return (
    <div style={panelStyle}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Lote</th>
              <th style={thStyle}>Código</th>
              <th style={thStyle}>Producto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Cantidad</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total Unit. (USD)</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const total = (Number(it.costUnit) || 0) + (Number(it.taxUnit) || 0);
              return (
                <tr key={it.id}>
                  <td style={tdStyle}><CodePill color="#f59e0b">{it.lote}</CodePill></td>
                  <td style={tdStyle}><CodePill>{it.code}</CodePill></td>
                  <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: 'normal' }}>{it.name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(it.qty) || 0}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{usd(total)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => onApprove(it)}
                      className="btn-solid"
                      style={{ padding: '7px 14px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}
                    >
                      <i className="fa-solid fa-circle-check"></i> Aprobar Ingreso
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══ SUB-PESTAÑA 2.B: Inventario en Bodega (Stock Final) ═════════════════════
function WarehouseSubTab({ items, categories = [], onEdit, onRevert }) {
  const catName = (id) => categories.find(c => c.id === id)?.name || id || '—';
  if (items.length === 0) {
    return <div style={panelStyle}><EmptyState icon="fa-warehouse" text="La bodega está vacía. Aprobá ítems pendientes para que aparezcan aquí." /></div>;
  }
  return (
    <div style={panelStyle}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Código</th>
              <th style={thStyle}>Producto</th>
              <th style={thStyle}>Categoría</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Días de Tránsito</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Cant. Ingresada</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Salidas</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Stock</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total USD</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Envío Unit. USD</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Costo Real (C$)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Precio Sugerido (C$)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ganancia Est.</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const c = computeWarehouse(it);
              const dias = daysBetween(it.purchaseDate, it.entryDate);
              return (
                <tr key={it.id}>
                  <td style={tdStyle}><CodePill>{it.code}</CodePill></td>
                  <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: 'normal' }}>{it.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-soft)' }}>{catName(it.category)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{dias == null ? '—' : `${dias} d`}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{c.qtyIn}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-soft)' }}>{c.salidas}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>{c.stock}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{usd(c.totalUSD)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{usd(c.shippingUnit)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{cor(c.costoReal)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>
                    {corInt(c.precioSugerido)}
                    <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--muted)' }}>margen {Math.round(c.margin * 100)}%</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{cor(c.ganancia)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button title="Editar ingreso" onClick={() => onEdit(it)} style={{ padding: '6px 9px', borderRadius: '7px', cursor: 'pointer', background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-soft)', fontSize: '12.5px' }}>
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button title="Revertir ingreso a pendientes" onClick={() => onRevert(it)} style={{ padding: '6px 11px', borderRadius: '7px', cursor: 'pointer', background: 'rgba(245,158,11,0.15)', border: 'none', color: '#f59e0b', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <i className="fa-solid fa-rotate-left"></i> Revertir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══ Modal de Edición de Compra en China ═════════════════════════════════════
function ChinaEditModal({ item, onConfirm, onCancel }) {
  const [form, setForm] = useState({
    purchaseDate: item.purchaseDate || '',
    lote: item.lote || '',
    code: item.code || '',
    name: item.name || '',
    qty: item.qty ?? '',
    costUnit: item.costUnit ?? '',
    taxUnit: item.taxUnit ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const filled = (v) => String(v).trim() !== '';
  const valid = filled(form.purchaseDate) && filled(form.lote) && filled(form.code) && filled(form.name)
    && Number(form.qty) > 0 && filled(form.costUnit) && filled(form.taxUnit);

  async function confirm() {
    if (!valid || saving) return;
    setSaving(true);
    try { await onConfirm(item.id, { ...form }); }
    catch { /* el padre muestra el toast */ }
    finally { setSaving(false); }
  }

  const fields = [
    { k: 'purchaseDate', label: 'Fecha de compra', type: 'date' },
    { k: 'lote', label: 'Lote', type: 'text', ph: 'Ej. LT1' },
    { k: 'code', label: 'Código', type: 'text', ph: 'Ej. IN1' },
    { k: 'name', label: 'Nombre del producto', type: 'text', ph: 'Ej. KZ Castor Pro', full: true },
    { k: 'qty', label: 'Cantidad', type: 'number', min: '1', step: '1', ph: '0' },
    { k: 'costUnit', label: 'Costo Unit. (USD)', type: 'number', min: '0', step: '0.01', ph: '0.00' },
    { k: 'taxUnit', label: 'Impuesto Unit. (USD)', type: 'number', min: '0', step: '0.0001', ph: '0.0000' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--accent)' }}></i> Editar compra en China
          </h2>
          <button onClick={onCancel} style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-soft)', fontSize: '18px' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {fields.map(f => (
              <div key={f.k} style={f.full ? { gridColumn: '1 / -1' } : undefined}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  style={inputStyle} type={f.type} min={f.min} step={f.step} placeholder={f.ph}
                  value={form[f.k]} onChange={e => set(f.k, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', paddingTop: '20px' }}>
            <button onClick={onCancel} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancelar</button>
            <button onClick={confirm} className="btn-solid" disabled={!valid || saving} style={{ flex: 2, padding: '11px', opacity: (valid && !saving) ? 1 : 0.5, cursor: (valid && !saving) ? 'pointer' : 'not-allowed' }}>
              {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-check"></i> Guardar cambios</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Modal de Aprobación de Ingreso ══════════════════════════════════════════
function ApproveModal({ item, categories = [], mode = 'approve', onConfirm, onCancel }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    entryDate: isEdit ? (item.entryDate || '') : '',
    shippingUnit: isEdit ? (item.shippingUnit ?? '') : '',
    category: isEdit ? (item.category || '') : '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.entryDate && form.category.trim();

  async function confirm() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onConfirm(item.id, { entryDate: form.entryDate, shippingUnit: parseFloat(form.shippingUnit) || 0, category: form.category.trim() });
    } catch {
      /* el padre muestra el toast; dejamos el modal abierto para reintentar */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', width: '100%', maxWidth: '440px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-circle-check'}`} style={{ color: isEdit ? 'var(--accent)' : '#10b981' }}></i> {isEdit ? 'Editar Ingreso a Bodega' : 'Aprobar Ingreso a Bodega'}
          </h2>
          <button onClick={onCancel} style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-soft)', fontSize: '18px' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: '10px', fontSize: '13px' }}>
            <strong style={{ color: 'var(--text)' }}>{item.name}</strong>
            <span style={{ color: 'var(--text-soft)' }}> · Lote {item.lote} · {item.code} · {Number(item.qty) || 0} uds</span>
          </div>
          <div>
            <label style={labelStyle}>Fecha de Ingreso</label>
            <input style={inputStyle} type="date" value={form.entryDate} onChange={e => set('entryDate', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Costo de envío unitario (USD)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.shippingUnit} onChange={e => set('shippingUnit', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={labelStyle}>Categoría</label>
            <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">Seleccione una categoría...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={onCancel} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancelar</button>
            <button
              onClick={confirm}
              className="btn-solid"
              disabled={!valid || saving}
              style={{ flex: 2, padding: '11px', opacity: (valid && !saving) ? 1 : 0.5, cursor: (valid && !saving) ? 'pointer' : 'not-allowed' }}
            >
              {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-check"></i> {isEdit ? 'Guardar cambios' : 'Confirmar ingreso'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Componente principal ════════════════════════════════════════════════════
export default function InventoryManagement({ user, signOutPortal }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState('china'); // 'china' | 'inventory'
  const [subTab, setSubTab] = useState('pending'); // 'pending' | 'warehouse'
  const [approveTarget, setApproveTarget] = useState(null);
  const [editChinaTarget, setEditChinaTarget] = useState(null);
  const [editWarehouseTarget, setEditWarehouseTarget] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadItems = useCallback(async () => {
    try {
      const data = await authedFetch('/inventory', user);
      const arr = Array.isArray(data) ? data : [];
      // Orden natural por código: IN1, IN2, IN3 … IN10 (no IN1, IN10, IN2).
      arr.sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' }));
      setItems(arr);
    } catch (err) {
      showToast('Error al cargar inventario: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Categorías del catálogo (mismas que se usan en el catálogo público y admin).
  useEffect(() => { fetchConfig().then(cfg => setCategories(cfg.categories || [])).catch(() => {}); }, []);

  // Deep-link desde el Action Center: ?view=pending abre Inventario › Pendiente de aprobar.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('view') === 'pending') { setMainTab('inventory'); setSubTab('pending'); }
  }, [searchParams]);

  const pendingItems = items.filter(i => i.status === 'pending');
  const receivedItems = items.filter(i => i.status === 'received');

  async function handleAdd(data) {
    try {
      await authedFetch('/inventory', user, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      await loadItems();
      showToast(`"${data.name.trim()}" agregado al lote ${data.lote.trim()}.`);
    } catch (err) {
      showToast('Error al agregar: ' + err.message);
      throw err; // ChinaTab usa esto para conservar el formulario
    }
  }

  async function handleReport(id) {
    try {
      await authedFetch(`/inventory/${id}/report`, user, { method: 'PATCH' });
      await loadItems();
      showToast('Estado cambiado a "Pendiente de aprobar". Aprobalo desde Inventario › Pendiente de aprobar.');
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  }

  async function handleApprove(id, extra) {
    try {
      await authedFetch(`/inventory/${id}/approve`, user, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extra) });
    } catch (err) {
      showToast('Error al aprobar: ' + err.message);
      throw err; // ApproveModal usa esto para dejar el modal abierto
    }
    await loadItems();
    setApproveTarget(null);
    setSubTab('warehouse');
    showToast('Ingreso aprobado. Estado: "Recibido" — el producto ya está en Bodega.');
  }

  async function handleEditChina(id, data) {
    try {
      await authedFetch(`/inventory/${id}`, user, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } catch (err) { showToast('Error al editar: ' + err.message); throw err; }
    await loadItems();
    setEditChinaTarget(null);
    showToast('Compra actualizada.');
  }

  async function handleEditWarehouse(id, data) {
    try {
      await authedFetch(`/inventory/${id}`, user, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } catch (err) { showToast('Error al editar: ' + err.message); throw err; }
    await loadItems();
    setEditWarehouseTarget(null);
    showToast('Ingreso actualizado. Costo Real y Precio Sugerido recalculados.');
  }

  async function handleRevert(item) {
    if (!window.confirm(`¿Revertir el ingreso de "${item.name}"? Saldrá de Bodega y volverá a "Pendiente de aprobar".`)) return;
    try {
      await authedFetch(`/inventory/${item.id}/revert`, user, { method: 'PATCH' });
      await loadItems();
      setSubTab('pending');
      showToast('Ingreso revertido. El ítem volvió a "Pendiente de aprobar".');
    } catch (err) {
      showToast('Error al revertir: ' + err.message);
    }
  }

  const unitsInWarehouse = receivedItems.reduce((s, i) => s + (computeWarehouse(i).stock || 0), 0);

  const kpis = [
    { label: 'Compras registradas', value: items.length, icon: 'fa-plane-departure', color: '#7c83ff' },
    { label: 'Pendiente de aprobar', value: pendingItems.length, icon: 'fa-clock', color: '#f59e0b' },
    { label: 'Recibidos en Bodega', value: receivedItems.length, icon: 'fa-warehouse', color: '#10b981' },
    { label: 'Unidades en Stock', value: unitsInWarehouse, icon: 'fa-layer-group', color: '#22c55e' },
  ];

  return (
    <PortalLayout title="Gestión de Inventario" icon="📦" user={user} signOutPortal={signOutPortal} currentPortal="inventario">
      <div>
        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '30px', color: 'var(--accent)' }}></i>
            <p style={{ color: 'var(--text-soft)', marginTop: '14px' }}>Cargando inventario...</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '22px' }}>
              {kpis.map(k => (
                <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${k.icon}`} style={{ color: k.color, fontSize: '17px' }}></i>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--heading-color)' }}>{k.value}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-soft)', fontWeight: 600 }}>{k.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pestañas principales */}
            <div className="tabs" style={{ marginBottom: '18px' }}>
              <button className={`tab${mainTab === 'china' ? ' active' : ''}`} onClick={() => setMainTab('china')}>
                <i className="fa-solid fa-cart-shopping" style={{ marginRight: '7px' }}></i>
                Registro de compras en China
                {items.length > 0 && <span style={{ marginLeft: '7px', opacity: 0.7 }}>({items.length})</span>}
              </button>
              <button className={`tab${mainTab === 'inventory' ? ' active' : ''}`} onClick={() => setMainTab('inventory')}>
                <i className="fa-solid fa-boxes-stacked" style={{ marginRight: '7px' }}></i>
                Inventario
                {(pendingItems.length + receivedItems.length) > 0 && <span style={{ marginLeft: '7px', opacity: 0.7 }}>({pendingItems.length + receivedItems.length})</span>}
              </button>
            </div>

            {mainTab === 'china' && (
              <ChinaTab items={items} onAdd={handleAdd} onReport={handleReport} onEdit={setEditChinaTarget} />
            )}

            {mainTab === 'inventory' && (
              <>
                {/* Sub-pestañas */}
                <div className="tabs" style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.12)' }}>
                  <button className={`tab${subTab === 'pending' ? ' active' : ''}`} onClick={() => setSubTab('pending')}>
                    <i className="fa-solid fa-clock" style={{ marginRight: '7px' }}></i>
                    Pendiente de aprobar
                    {pendingItems.length > 0 && <span style={{ marginLeft: '7px', opacity: 0.7 }}>({pendingItems.length})</span>}
                  </button>
                  <button className={`tab${subTab === 'warehouse' ? ' active' : ''}`} onClick={() => setSubTab('warehouse')}>
                    <i className="fa-solid fa-warehouse" style={{ marginRight: '7px' }}></i>
                    Inventario en Bodega
                    {receivedItems.length > 0 && <span style={{ marginLeft: '7px', opacity: 0.7 }}>({receivedItems.length})</span>}
                  </button>
                </div>

                {subTab === 'pending'
                  ? <PendingSubTab items={pendingItems} onApprove={setApproveTarget} />
                  : <WarehouseSubTab items={receivedItems} categories={categories} onEdit={setEditWarehouseTarget} onRevert={handleRevert} />}
              </>
            )}
          </>
        )}
      </div>

      {approveTarget && (
        <ApproveModal item={approveTarget} categories={categories} onConfirm={handleApprove} onCancel={() => setApproveTarget(null)} />
      )}

      {editChinaTarget && (
        <ChinaEditModal item={editChinaTarget} onConfirm={handleEditChina} onCancel={() => setEditChinaTarget(null)} />
      )}

      {editWarehouseTarget && (
        <ApproveModal item={editWarehouseTarget} categories={categories} mode="edit" onConfirm={handleEditWarehouse} onCancel={() => setEditWarehouseTarget(null)} />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 18px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 600, display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '360px' }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#10b981', flexShrink: 0 }}></i>
          {toast}
        </div>
      )}
    </PortalLayout>
  );
}
