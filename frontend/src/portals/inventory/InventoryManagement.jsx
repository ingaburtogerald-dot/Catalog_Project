import { useState, useEffect, useCallback } from 'react';
import PortalLayout from '../layout/PortalLayout';
import { authedFetch } from '../lib/portalApi';

const EMPTY_FORM = { code: '', name: '', category: '', priceUSD: '', priceNIO: '', stock: '' };

function StockBadge({ stock }) {
  const n = Number(stock);
  const color = n > 10 ? '#10b981' : n > 0 ? '#f59e0b' : '#ef4444';
  const label = n > 10 ? 'En stock' : n > 0 ? 'Bajo stock' : 'Agotado';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.4px',
      background: `${color}18`, color, border: `1px solid ${color}40`,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      {n} · {label}
    </span>
  );
}

function ProductModal({ product, onClose, onSaved, user }) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState(product ? {
    code: product.code || '',
    name: product.name || '',
    category: product.category || '',
    priceUSD: product.priceUSD ?? '',
    priceNIO: product.priceNIO ?? '',
    stock: product.stock ?? '',
  } : { ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.code) { setError('El código y el nombre son obligatorios.'); return; }
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        priceUSD: parseFloat(form.priceUSD) || 0,
        priceNIO: parseFloat(form.priceNIO) || 0,
        stock: parseInt(form.stock, 10) || 0,
      };
      if (isEdit) {
        await authedFetch(`/products/${product.id}`, user, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await authedFetch('/products', user, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--input-border)', background: 'var(--input-bg)',
    color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '5px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-plus'}`} style={{ color: 'var(--accent)' }}></i>
            {isEdit ? 'Editar Producto' : 'Agregar Producto'}
          </h2>
          <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-soft)', fontSize: '18px' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '13px', display: 'flex', gap: '8px' }}>
              <i className="fa-solid fa-triangle-exclamation"></i> {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Código <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inputStyle} value={form.code} onChange={e => set('code', e.target.value)} placeholder="Ej. KZ-001" required />
            </div>
            <div>
              <label style={labelStyle}>Categoría</label>
              <input style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)} placeholder="Ej. KZ In-Ear" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Nombre del Producto <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. KZ Castor" required />
            </div>
            <div>
              <label style={labelStyle}>Precio USD ($)</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.priceUSD} onChange={e => set('priceUSD', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Precio NIO (C$)</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.priceNIO} onChange={e => set('priceNIO', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Stock</label>
              <input style={inputStyle} type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>
              Cancelar
            </button>
            <button type="submit" className="btn-solid" disabled={loading} style={{ flex: 2, padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading
                ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</>
                : <><i className="fa-solid fa-check"></i> {isEdit ? 'Actualizar' : 'Agregar'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryManagement({ user, signOutPortal }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStock, setFilterStock] = useState('all'); // 'all' | 'instock' | 'outofstock'
  const [modal, setModal] = useState(null); // null | { product } (null product = new)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedFetch('/products?all=true', user);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Error al cargar productos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await authedFetch(`/products/${deleteTarget.id}`, user, { method: 'DELETE' });
      showToast(`"${deleteTarget.name}" eliminado.`);
      setDeleteTarget(null);
      loadProducts();
    } catch (err) {
      showToast('Error al eliminar: ' + err.message);
    }
  }

  const filtered = products.filter(p => {
    const term = search.toLowerCase();
    const matchSearch = !term || p.name?.toLowerCase().includes(term) || p.code?.toLowerCase().includes(term) || p.category?.toLowerCase().includes(term);
    const matchStock = filterStock === 'all' || (filterStock === 'instock' ? p.stock > 0 : p.stock === 0);
    return matchSearch && matchStock;
  });

  const totalStock = products.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const outOfStock = products.filter(p => p.stock === 0).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;

  const thStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)' };
  const tdStyle = { padding: '13px 14px', borderBottom: '1px solid var(--border)', fontSize: '14px', verticalAlign: 'middle' };

  return (
    <PortalLayout title="Gestión de Inventario" icon="📦" user={user} signOutPortal={signOutPortal} currentPortal="inventario">
      <div style={{ maxWidth: '1200px' }}>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total Productos', value: products.length, icon: 'fa-box', color: '#7c83ff' },
            { label: 'Unidades en Stock', value: totalStock, icon: 'fa-layer-group', color: '#10b981' },
            { label: 'Bajo Stock (≤10)', value: lowStock, icon: 'fa-triangle-exclamation', color: '#f59e0b' },
            { label: 'Agotados', value: outOfStock, icon: 'fa-ban', color: '#ef4444' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
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

        {/* Toolbar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)', fontSize: '13px' }}></i>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código o categoría..."
              style={{ width: '100%', paddingLeft: '36px', paddingRight: '12px', paddingTop: '10px', paddingBottom: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '13.5px', boxSizing: 'border-box' }}
            />
          </div>
          <select
            value={filterStock}
            onChange={e => setFilterStock(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '13.5px' }}
          >
            <option value="all">Todos</option>
            <option value="instock">En stock</option>
            <option value="outofstock">Agotados</option>
          </select>
          <button
            onClick={() => setModal({ product: null })}
            className="btn-solid"
            style={{ padding: '10px 18px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <i className="fa-solid fa-plus"></i> Agregar Producto
          </button>
        </div>

        {/* Tabla */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '28px', color: 'var(--accent)' }}></i>
              <p style={{ color: 'var(--text-soft)', marginTop: '12px' }}>Cargando inventario...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <i className="fa-solid fa-box-open" style={{ fontSize: '36px', color: 'var(--muted)' }}></i>
              <p style={{ color: 'var(--text-soft)', marginTop: '12px', fontSize: '15px' }}>
                {search ? 'No se encontraron productos con ese criterio.' : 'No hay productos en el inventario.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Código</th>
                    <th style={thStyle}>Producto</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>USD</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>NIO</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Stock</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--tr-hover, rgba(255,255,255,0.02))'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', background: 'rgba(124,131,255,0.15)', color: 'var(--accent)', borderRadius: '6px', fontSize: '12px', fontWeight: 800, fontFamily: 'monospace' }}>
                          {p.code || '—'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, maxWidth: '220px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-soft)', fontSize: '13px' }}>{p.category || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                        {p.priceUSD != null ? `$${Number(p.priceUSD).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                        {p.priceNIO != null ? `C$${Number(p.priceNIO).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <StockBadge stock={p.stock ?? 0} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => setModal({ product: p })}
                            style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: 'rgba(124,131,255,0.15)', color: 'var(--accent)', fontSize: '12.5px', fontWeight: 700 }}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '12.5px', fontWeight: 700 }}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--muted)', textAlign: 'right' }}>
              Mostrando {filtered.length} de {products.length} productos
            </div>
          )}
        </div>
      </div>

      {/* Modal Add/Edit */}
      {modal && (
        <ProductModal
          product={modal.product}
          user={user}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadProducts(); showToast('Producto guardado con éxito.'); }}
        />
      )}

      {/* Modal Eliminar */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', maxWidth: '380px', width: '100%' }}>
            <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '12px' }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '17px' }}>Eliminar Producto</h3>
            <p style={{ color: 'var(--text-soft)', textAlign: 'center', fontSize: '14px', margin: '0 0 24px' }}>
              ¿Estás seguro de eliminar <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: '11px', borderRadius: '20px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 18px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
          {toast}
        </div>
      )}
    </PortalLayout>
  );
}
