import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import PortalLayout from '../layout/PortalLayout';
import { authedFetch } from '../lib/portalApi';
import { fetchConfig } from '../../lib/api';

// ─── Constantes del flujo ────────────────────────────────────────────────────
const EXCHANGE_RATE = 37; // C$ por USD

const categorySuggestions = {
  'Audífonos In-Ear': ['MICRÓFONO', 'SIN MICRÓFONO', 'NEGRO', 'BLANCO', 'PIN C'],
  'Cables': ['JACK 3.5 MM', 'JACK 4.4 MM', 'PIN C', 'QDC'],
  'DACs/Amplificadores': ['BASS', 'HARMAN', 'BLUETOOTH', 'TYPE-C'],
  'Repuestos': ['ALMOHADILLAS', 'PIN C', 'QDC'],
  'Otros': ['NEGRO', 'BLANCO', 'GRIS', 'TRANSPARENTE']
};

const getTagStyle = (tag) => {
  const t = tag.toLowerCase().trim();

  // Conectores (Azul/Celeste)
  if (t.includes('jack') || t === 'tipe' || t.includes('type-c') || t.includes('plug')) {
    return {
      background: 'rgba(14, 165, 233, 0.12)',
      border: '1px solid rgba(14, 165, 233, 0.35)',
      color: '#38bdf8',
    };
  }
  // Bluetooth y Pines (Morado/Violeta)
  if (t.includes('pin') || t.includes('bluetooth') || t.includes('bt')) {
    return {
      background: 'rgba(168, 85, 247, 0.12)',
      border: '1px solid rgba(168, 85, 247, 0.35)',
      color: '#c084fc',
    };
  }
  // Micrófono (Verde / Rojo suave)
  if (t === 'micrófono' || t === 'con micrófono' || t === 'con mic') {
    return {
      background: 'rgba(16, 185, 129, 0.12)',
      border: '1px solid rgba(16, 185, 129, 0.35)',
      color: '#34d399',
    };
  }
  if (t === 'sin micrófono' || t === 'sin mic') {
    return {
      background: 'rgba(239, 68, 68, 0.08)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      color: '#fca5a5',
    };
  }
  // Variantes de sintonización (Rosa / Amarillo)
  if (t.includes('harman')) {
    return {
      background: 'rgba(244, 63, 94, 0.12)',
      border: '1px solid rgba(244, 63, 94, 0.35)',
      color: '#fb7185',
    };
  }
  if (t.includes('bass')) {
    return {
      background: 'rgba(234, 179, 8, 0.12)',
      border: '1px solid rgba(234, 179, 8, 0.35)',
      color: '#facc15',
    };
  }
  // Colores conocidos
  if (t === 'azul turquesa' || t.includes('turquesa')) {
    return {
      background: 'rgba(6, 182, 212, 0.12)',
      border: '1px solid rgba(6, 182, 212, 0.35)',
      color: '#22d3ee',
    };
  }
  if (t === 'transparente' || t === 'cristal') {
    return {
      background: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.25)',
      color: '#e4e4e7',
    };
  }
  if (t === 'negro') {
    return {
      background: 'rgba(9, 9, 11, 0.6)',
      border: '1px solid rgba(63, 63, 70, 0.5)',
      color: '#fafafa',
    };
  }
  if (t === 'gris') {
    return {
      background: 'rgba(113, 113, 122, 0.12)',
      border: '1px solid rgba(113, 113, 122, 0.35)',
      color: '#d4d4d8',
    };
  }

  // Por defecto (Gris neutro)
  return {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border)',
    color: 'var(--text-soft)',
  };
};

const renderProductName = (name) => {
  if (!name) return '—';
  const parts = name.split('|').map(p => p.trim());
  if (parts.length <= 1) {
    return <span style={{ fontWeight: 700, color: 'var(--text)' }}>{name}</span>;
  }
  const title = parts[0];
  const tags = parts.slice(1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '220px', whiteSpace: 'normal' }}>
      <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--heading-color)', lineHeight: 1.25 }}>
        {title}
      </span>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
        {tags.map((tag, idx) => {
          const style = getTagStyle(tag);
          return (
            <span
              key={idx}
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                ...style
              }}
            >
              {tag}
            </span>
          );
        })}
      </div>
    </div>
  );
};

function KpiCard({ k }) {
  const isClickable = k.clickable;
  const isActive = k.active;
  return (
    <div 
      onClick={isClickable ? k.onClick : undefined}
      style={{ 
        background: 'var(--surface)', 
        border: isActive ? `1.5px solid ${k.color}` : '1px solid var(--border)', 
        borderRadius: '14px', 
        padding: '16px 18px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '14px',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        boxShadow: isActive ? `0 0 12px \${k.color}20` : 'none',
        transform: isClickable && isActive ? 'translateY(-1px)' : 'none',
      }}
      onMouseEnter={e => {
        if (isClickable) {
          e.currentTarget.style.borderColor = k.color;
          e.currentTarget.style.boxShadow = `0 4px 12px \${k.color}15`;
        }
      }}
      onMouseLeave={e => {
        if (isClickable) {
          e.currentTarget.style.borderColor = isActive ? k.color : 'var(--border)';
          e.currentTarget.style.boxShadow = isActive ? `0 0 12px \${k.color}20` : 'none';
        }
      }}
    >
      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `\${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fa-solid \${k.icon}`} style={{ color: k.color, fontSize: '17px' }}></i>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--heading-color)' }}>{k.value}</p>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-soft)', fontWeight: 600 }}>{k.label}</p>
      </div>
    </div>
  );
}

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

// ─── Menú ⋯ con portal — evita ser recortado por overflow:auto de la tabla ───
function RowMenu({ item, open, onToggleOpen, onEdit }) {
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  function handleOpen(e) {
    e.stopPropagation();
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.right - 140 });
    onToggleOpen(!open);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => onToggleOpen(false);
    // Bubble phase (no capture). El stopPropagation del div del portal evita que
    // clics DENTRO del menú lleguen aquí. Solo clics FUERA cierran el menú.
    // setTimeout(0) descarta el mismo clic que abrió el menú.
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', close); };
  }, [open, onToggleOpen]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="Más opciones"
        style={{ padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-soft)', fontSize: '14px', lineHeight: 1 }}
      >
        <i className="fa-solid fa-ellipsis-vertical"></i>
      </button>
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '9px', boxShadow: '0 6px 20px rgba(0,0,0,0.3)', minWidth: '140px', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { onEdit(item); onToggleOpen(false); }}
            style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '13px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '9px', fontWeight: 600 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,131,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <i className="fa-solid fa-pen" style={{ color: 'var(--accent)', fontSize: '12px', width: '14px' }}></i>
            Editar
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Formatea un string 'YYYY-MM' como 'Abril de 2026' ───────────────────────
const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// ═══ PESTAÑA 1: Registro de compras en China ═════════════════════════════════
function ChinaTab({ items, isFiltered, onAdd, onReport, onEdit }) {
  const EMPTY = { purchaseDate: '', lote: '', code: '', name: '', qty: '', costUnit: '', taxUnit: '', category: '' };
  const [form, setForm] = useState(EMPTY);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const filled = (v) => String(v).trim() !== '';
  const valid = filled(form.purchaseDate) && filled(form.lote) && filled(form.code) && filled(form.name)
    && filled(form.category) && Number(form.qty) > 0 && filled(form.costUnit) && filled(form.taxUnit);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (idxToRemove) => {
    setTags(tags.filter((_, idx) => idx !== idxToRemove));
  };

  const handleAddTag = (tag) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const suggestions = useMemo(() => {
    if (!form.category) return [];
    return categorySuggestions[form.category] || [];
  }, [form.category]);

  // Totales financieros del set ya filtrado globalmente por el padre
  const totalCost = items.reduce((s, it) => s + (Number(it.costUnit) || 0) * (Number(it.qty) || 0), 0);
  const totalTax  = items.reduce((s, it) => s + (Number(it.taxUnit)  || 0) * (Number(it.qty) || 0), 0);
  const totalPaid = totalCost + totalTax;

  async function submit(e) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const finalTags = [...tags];
      const leftover = tagInput.trim().replace(/,/g, '');
      if (leftover && !finalTags.includes(leftover)) {
        finalTags.push(leftover);
      }
      const finalName = [form.name.trim(), ...finalTags].filter(Boolean).join(' | ');
      await onAdd({ ...form, name: finalName });
      setForm(EMPTY);
      setTags([]);
      setTagInput('');
    } catch {
      /* el componente padre ya mostró el toast de error; conservamos el formulario */
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* ── Formulario de ingreso ── */}
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
            <label style={labelStyle}>Nombre base del producto</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. KZ Castor Pro" />
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={labelStyle}>Categoría</label>
            <select
              style={inputStyle}
              value={form.category}
              onChange={e => set('category', e.target.value)}
              required
            >
              <option value="">Seleccione una categoría...</option>
              <option value="Audífonos In-Ear">Audífonos In-Ear</option>
              <option value="Cables">Cables</option>
              <option value="DACs/Amplificadores">DACs/Amplificadores</option>
              <option value="Repuestos">Repuestos</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
          <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
            <label style={labelStyle}>Especificaciones / Variantes</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', minHeight: '38px', alignItems: 'center' }}>
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '5px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    ...getTagStyle(tag)
                  }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(idx)}
                    style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', fontSize: '10px', opacity: 0.6 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tags.length === 0 ? "Escribe y presiona Enter o Coma..." : ""}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none',
                  flex: 1,
                  minWidth: '120px',
                  padding: '2px 0'
                }}
              />
            </div>
            {!form.category ? (
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-soft)', fontStyle: 'italic' }}>
                Selecciona una categoría para ver sugerencias rápidas
              </div>
            ) : (
              suggestions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-soft)' }}>Sugerencias rápidas:</span>
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAddTag(s)}
                      disabled={tags.includes(s)}
                      style={{
                        border: 'none',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: tags.includes(s) ? 'not-allowed' : 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        opacity: tags.includes(s) ? 0.4 : 1,
                        transition: 'all 0.15s ease',
                        ...getTagStyle(s)
                      }}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )
            )}
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

      {/* ── Tabla de compras ── */}
      <div style={panelStyle}>
        {items.length === 0 ? (
          isFiltered
            ? <EmptyState icon="fa-filter" text="Ningún registro coincide con los filtros seleccionados." />
            : <EmptyState icon="fa-plane-departure" text="No hay compras registradas. Agregá la primera con el formulario de arriba." />
        ) : (
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
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  <th style={{ ...thStyle, width: '40px' }}></th>
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
                      <td style={{ ...tdStyle, padding: '12px 14px' }}>{renderProductName(it.name)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(it.qty) || 0}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{usd(it.costUnit)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{usd4(it.taxUnit)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>{usd(total)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {it.status === 'china' ? (
                          <button
                            onClick={() => onReport(it.id)}
                            style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', fontSize: '12.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}
                          >
                            <i className="fa-solid fa-flag-checkered"></i> Reportar recibido
                          </button>
                        ) : (
                          <StatusBadge status={it.status} />
                        )}
                      </td>
                      {/* ── Menú ⋯ (portal, sin clip por overflow) ── */}
                      <td style={{ ...tdStyle, textAlign: 'center', padding: '12px 10px' }}>
                        <RowMenu
                          item={it}
                          open={openMenuId === it.id}
                          onToggleOpen={(isOpen) => setOpenMenuId(isOpen ? it.id : null)}
                          onEdit={onEdit}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cuadro de Resumen Financiero (abajo de la tabla) ── */}
      {items.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 24px', marginTop: '16px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Resumen financiero
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Subtotal (sin imp.)</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>{usd(totalCost)}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Impuestos pagados</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>{usd(totalTax)}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'rgba(124,131,255,0.08)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(124,131,255,0.2)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total (con imp.)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)' }}>{usd(totalPaid)}</div>
            </div>
          </div>
        </div>
      )}
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
                  <td style={{ ...tdStyle, padding: '12px 14px' }}>{renderProductName(it.name)}</td>
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
                  <td style={{ ...tdStyle, padding: '12px 14px' }}>{renderProductName(it.name)}</td>
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
function ChinaEditModal({ item, items = [], onConfirm, onCancel }) {
  const initialParts = (item.name || '').split('|').map(p => p.trim());
  const initialBaseName = initialParts[0] || '';
  const initialTags = initialParts.slice(1);

  const [form, setForm] = useState({
    purchaseDate: item.purchaseDate || '',
    lote: item.lote || '',
    code: item.code || '',
    name: initialBaseName,
    qty: item.qty ?? '',
    costUnit: item.costUnit ?? '',
    taxUnit: item.taxUnit ?? '',
    category: item.category || '',
  });
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const filled = (v) => String(v).trim() !== '';
  const valid = filled(form.purchaseDate) && filled(form.lote) && filled(form.code) && filled(form.name)
    && filled(form.category) && Number(form.qty) > 0 && filled(form.costUnit) && filled(form.taxUnit);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (idxToRemove) => {
    setTags(tags.filter((_, idx) => idx !== idxToRemove));
  };

  const handleAddTag = (tag) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const suggestions = useMemo(() => {
    if (!form.category) return [];
    return categorySuggestions[form.category] || [];
  }, [form.category]);

  async function confirm() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const finalTags = [...tags];
      const leftover = tagInput.trim().replace(/,/g, '');
      if (leftover && !finalTags.includes(leftover)) {
        finalTags.push(leftover);
      }
      const finalName = [form.name.trim(), ...finalTags].filter(Boolean).join(' | ');
      await onConfirm(item.id, { ...form, name: finalName });
    }
    catch { /* el padre muestra el toast */ }
    finally { setSaving(false); }
  }

  const fields = [
    { k: 'purchaseDate', label: 'Fecha de compra', type: 'date' },
    { k: 'lote', label: 'Lote', type: 'text', ph: 'Ej. LT1' },
    { k: 'code', label: 'Código', type: 'text', ph: 'Ej. IN1' },
    { k: 'name', label: 'Nombre base del producto', type: 'text', ph: 'Ej. KZ Castor Pro', full: true },
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
            {fields.slice(0, 4).map(f => (
              <div key={f.k} style={f.full ? { gridColumn: '1 / -1' } : undefined}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  style={inputStyle} type={f.type} min={f.min} step={f.step} placeholder={f.ph}
                  value={form[f.k]} onChange={e => set(f.k, e.target.value)}
                />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Categoría</label>
              <select
                style={inputStyle}
                value={form.category}
                onChange={e => set('category', e.target.value)}
                required
              >
                <option value="">Seleccione una categoría...</option>
                <option value="Audífonos In-Ear">Audífonos In-Ear</option>
                <option value="Cables">Cables</option>
                <option value="DACs/Amplificadores">DACs/Amplificadores</option>
                <option value="Repuestos">Repuestos</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
            {fields.slice(4).map(f => (
              <div key={f.k} style={f.full ? { gridColumn: '1 / -1' } : undefined}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  style={inputStyle} type={f.type} min={f.min} step={f.step} placeholder={f.ph}
                  value={form[f.k]} onChange={e => set(f.k, e.target.value)}
                />
              </div>
            ))}
          </div>
          {/* Tags input inside ChinaEditModal */}
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Especificaciones / Variantes</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', minHeight: '38px', alignItems: 'center' }}>
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '5px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    ...getTagStyle(tag)
                  }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(idx)}
                    style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', fontSize: '10px', opacity: 0.6 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tags.length === 0 ? "Escribe y presiona Enter o Coma..." : ""}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none',
                  flex: 1,
                  minWidth: '120px',
                  padding: '2px 0'
                }}
              />
            </div>
            {!form.category ? (
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-soft)', fontStyle: 'italic' }}>
                Selecciona una categoría para ver sugerencias rápidas
              </div>
            ) : (
              suggestions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-soft)' }}>Sugerencias rápidas:</span>
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAddTag(s)}
                      disabled={tags.includes(s)}
                      style={{
                        border: 'none',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: tags.includes(s) ? 'not-allowed' : 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        opacity: tags.includes(s) ? 0.4 : 1,
                        transition: 'all 0.15s ease',
                        ...getTagStyle(s)
                      }}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )
            )}
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
function ApproveModal({ item, categories = [], items = [], mode = 'approve', onConfirm, onCancel }) {
  const isEdit = mode === 'edit';

  const initialParts = (item.name || '').split('|').map(p => p.trim());
  const initialBaseName = initialParts[0] || '';
  const initialTags = initialParts.slice(1);

  const [form, setForm] = useState({
    entryDate: isEdit ? (item.entryDate || '') : '',
    shippingUnit: isEdit ? (item.shippingUnit ?? '') : '',
    category: item.category || '',
    name: isEdit ? initialBaseName : item.name,
  });

  const [tags, setTags] = useState(isEdit ? initialTags : []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const valid = form.entryDate && form.category.trim() && (!isEdit || form.name.trim() !== '');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (idxToRemove) => {
    setTags(tags.filter((_, idx) => idx !== idxToRemove));
  };

  const handleAddTag = (tag) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const suggestions = useMemo(() => {
    if (!isEdit) return [];
    if (!form.category) return [];
    return categorySuggestions[form.category] || [];
  }, [form.category, isEdit]);

  async function confirm() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const extra = {
        entryDate: form.entryDate,
        shippingUnit: parseFloat(form.shippingUnit) || 0,
        category: form.category.trim(),
      };
      if (isEdit) {
        const finalTags = [...tags];
        const leftover = tagInput.trim().replace(/,/g, '');
        if (leftover && !finalTags.includes(leftover)) {
          finalTags.push(leftover);
        }
        extra.name = [form.name.trim(), ...finalTags].filter(Boolean).join(' | ');
      }
      await onConfirm(item.id, extra);
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
          {!isEdit ? (
            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: '10px' }}>
              {renderProductName(item.name)}
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-soft)', fontWeight: 600 }}>
                Lote {item.lote} · {item.code} · {Number(item.qty) || 0} uds
              </div>
            </div>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Nombre base del producto</label>
                <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. KZ Castor Pro" />
              </div>
              <div>
                <label style={labelStyle}>Especificaciones / Variantes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', minHeight: '38px', alignItems: 'center' }}>
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '5px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        ...getTagStyle(tag)
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(idx)}
                        style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', fontSize: '10px', opacity: 0.6 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={tags.length === 0 ? "Escribe y presiona Enter o Coma..." : ""}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '13px',
                      outline: 'none',
                      flex: 1,
                      minWidth: '120px',
                      padding: '2px 0'
                    }}
                  />
                </div>
                {!form.category ? (
                  <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-soft)', fontStyle: 'italic' }}>
                    Selecciona una categoría para ver sugerencias rápidas
                  </div>
                ) : (
                  suggestions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-soft)' }}>Sugerencias rápidas:</span>
                      {suggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleAddTag(s)}
                          disabled={tags.includes(s)}
                          style={{
                            border: 'none',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: tags.includes(s) ? 'not-allowed' : 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            opacity: tags.includes(s) ? 0.4 : 1,
                            transition: 'all 0.15s ease',
                            ...getTagStyle(s)
                          }}
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          )}
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

  // ── Filtros globales — afectan KPIs + todas las pestañas ─────────────────
  const [filterMonth, setFilterMonth] = useState('');
  const [filterLote, setFilterLote]   = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  const availableMonths = useMemo(() => {
    const s = new Set(items.map(it => String(it.purchaseDate || '').substring(0, 7)).filter(Boolean));
    return [...s].sort().reverse();
  }, [items]);

  const availableLotes = useMemo(() => {
    const s = new Set(items.map(it => it.lote).filter(Boolean));
    return [...s].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [items]);

  const baseFilteredItems = useMemo(() => items.filter(it => {
    if (filterMonth && String(it.purchaseDate || '').substring(0, 7) !== filterMonth) return false;
    if (filterLote  && it.lote !== filterLote) return false;
    return true;
  }), [items, filterMonth, filterLote]);

  const filteredItems = useMemo(() => baseFilteredItems.filter(it => {
    if (statusFilter && it.status !== statusFilter) return false;
    return true;
  }), [baseFilteredItems, statusFilter]);

  const isFiltered = Boolean(filterMonth || filterLote || statusFilter);

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

  const pendingItems = filteredItems.filter(i => i.status === 'pending');
  const receivedItems = filteredItems.filter(i => i.status === 'received');

  const handleKpiClick = (status) => {
    if (status === 'all') {
      setStatusFilter(null);
    } else {
      const isCurrentlyActive = statusFilter === status;
      const nextStatus = isCurrentlyActive ? null : status;
      
      setStatusFilter(nextStatus);
      
      if (nextStatus === 'china') {
        setMainTab('china');
      } else if (nextStatus === 'pending') {
        setMainTab('inventory');
        setSubTab('pending');
      } else if (nextStatus === 'received') {
        setMainTab('inventory');
        setSubTab('warehouse');
      }
    }
  };

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

  const kpis = [
    { 
      label: 'Compras registradas',  
      value: baseFilteredItems.length,
      icon: 'fa-ship',            
      color: '#7c83ff',
      clickable: true,
      onClick: () => handleKpiClick('all'),
      active: statusFilter === null
    },
    { 
      label: 'Pendiente de aprobar', 
      value: baseFilteredItems.filter(i => i.status === 'pending').length,                                   
      icon: 'fa-clipboard-check', 
      color: '#f59e0b',
      clickable: true,
      onClick: () => handleKpiClick('pending'),
      active: statusFilter === 'pending'
    },
    { 
      label: 'Recibidos en Bodega',  
      value: baseFilteredItems.filter(i => i.status === 'received').length,                                  
      icon: 'fa-warehouse',       
      color: '#10b981',
      clickable: true,
      onClick: () => handleKpiClick('received'),
      active: statusFilter === 'received'
    },
    { 
      label: 'En tránsito',          
      value: baseFilteredItems.filter(i => i.status === 'china').length, 
      icon: 'fa-truck-fast',      
      color: '#22c55e',
      clickable: true,
      onClick: () => handleKpiClick('china'),
      active: statusFilter === 'china'
    },
    { 
      label: 'Subtotal (sin imp.)',  
      value: usd(filteredItems.reduce((s, it) => s + (Number(it.costUnit) || 0) * (Number(it.qty) || 0), 0)),                                        
      icon: 'fa-file-invoice-dollar', 
      color: '#38bdf8',
      clickable: false
    },
    { 
      label: 'Impuestos pagados',    
      value: usd(filteredItems.reduce((s, it) => s + (Number(it.taxUnit)  || 0) * (Number(it.qty) || 0), 0)),                                         
      icon: 'fa-percent',         
      color: '#f59e0b',
      clickable: false
    },
    { 
      label: 'Total (con imp.)',     
      value: usd(filteredItems.reduce((s, it) => s + (Number(it.costUnit) || 0) * (Number(it.qty) || 0), 0) + filteredItems.reduce((s, it) => s + (Number(it.taxUnit)  || 0) * (Number(it.qty) || 0), 0)),                                         
      icon: 'fa-wallet',          
      color: '#7c83ff',
      clickable: false
    },
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
            {/* Filtros globales */}
            {items.length > 0 && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px', padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div style={{ minWidth: '170px' }}>
                  <label style={labelStyle}>Filtrar por mes</label>
                  <select style={inputStyle} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                    <option value="">Todos los meses</option>
                    {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: '140px' }}>
                  <label style={labelStyle}>Filtrar por lote</label>
                  <select style={inputStyle} value={filterLote} onChange={e => setFilterLote(e.target.value)}>
                    <option value="">Todos los lotes</option>
                    {availableLotes.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                {isFiltered && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setFilterMonth(''); setFilterLote(''); setStatusFilter(null); }}
                      style={{ padding: '9px 13px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-soft)', cursor: 'pointer', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-end' }}
                    >
                      <i className="fa-solid fa-xmark"></i> Limpiar filtros
                    </button>
                    <span style={{ alignSelf: 'flex-end', fontSize: '12px', color: 'var(--text-soft)', paddingBottom: '10px', fontWeight: 600 }}>
                      {filteredItems.length} de {items.length} registros
                    </span>
                  </>
                )}
              </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '22px' }}>
              {kpis.map(k => (
                <KpiCard key={k.label} k={k} />
              ))}
            </div>

            {/* Pestañas principales */}
            <div className="tabs" style={{ marginBottom: '18px' }}>
              <button className={`tab${mainTab === 'china' ? ' active' : ''}`} onClick={() => { setMainTab('china'); setStatusFilter(null); }}>
                <i className="fa-solid fa-cart-shopping" style={{ marginRight: '7px' }}></i>
                Registro de compras en China
                {items.length > 0 && <span style={{ marginLeft: '7px', opacity: 0.7 }}>({items.length})</span>}
              </button>
              <button className={`tab${mainTab === 'inventory' ? ' active' : ''}`} onClick={() => { setMainTab('inventory'); setStatusFilter(null); }}>
                <i className="fa-solid fa-boxes-stacked" style={{ marginRight: '7px' }}></i>
                Inventario
                {(pendingItems.length + receivedItems.length) > 0 && <span style={{ marginLeft: '7px', opacity: 0.7 }}>({pendingItems.length + receivedItems.length})</span>}
              </button>
            </div>

            {mainTab === 'china' && (
              <ChinaTab items={filteredItems} isFiltered={isFiltered} onAdd={handleAdd} onReport={handleReport} onEdit={setEditChinaTarget} />
            )}

            {mainTab === 'inventory' && (
              <>
                {/* Sub-pestañas */}
                <div className="tabs" style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.12)' }}>
                  <button className={`tab${subTab === 'pending' ? ' active' : ''}`} onClick={() => { setSubTab('pending'); setStatusFilter(null); }}>
                    <i className="fa-solid fa-clock" style={{ marginRight: '7px' }}></i>
                    Pendiente de aprobar
                    {pendingItems.length > 0 && <span style={{ marginLeft: '7px', opacity: 0.7 }}>({pendingItems.length})</span>}
                  </button>
                  <button className={`tab${subTab === 'warehouse' ? ' active' : ''}`} onClick={() => { setSubTab('warehouse'); setStatusFilter(null); }}>
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
        <ChinaEditModal item={editChinaTarget} items={items} onConfirm={handleEditChina} onCancel={() => setEditChinaTarget(null)} />
      )}

      {editWarehouseTarget && (
        <ApproveModal item={editWarehouseTarget} categories={categories} items={items} mode="edit" onConfirm={handleEditWarehouse} onCancel={() => setEditWarehouseTarget(null)} />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 18px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 600, display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '360px' }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#10b981', flexShrink: 0 }}></i>
          <span style={{ flexGrow: 1 }}>{toast}</span>
          <button 
            onClick={() => setToast('')} 
            style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-soft)', padding: '2px 4px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-soft)'}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}
    </PortalLayout>
  );
}
