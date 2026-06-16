import { useMemo, useRef, useState } from 'react';

// Misma escala de comisión progresiva que server/routes/orders.js (calculateCommission).
// Aquí es solo una ESTIMACIÓN para la UI — el monto final lo calcula el servidor
// con el costo real del lote al momento de aprobar la venta.
function estimateCommission(netProfit) {
  if (netProfit <= 0) return 0;
  if (netProfit <= 300) return netProfit * 0.45;
  if (netProfit <= 600) return netProfit * 0.40;
  if (netProfit <= 900) return netProfit * 0.38;
  if (netProfit <= 1000) return netProfit * 0.35;
  if (netProfit <= 1400) return netProfit * 0.32;
  if (netProfit <= 1800) return netProfit * 0.30;
  return netProfit * 0.28;
}

let lineIdCounter = 0;
function newLine() {
  return { key: ++lineIdCounter, productId: '', qty: 1, sellPrice: '' };
}

export default function ReportSaleModal({ products, user, currency, onClose, onSubmitted, onToast }) {
  const [lines, setLines] = useState([newLine()]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  function updateLine(key, patch) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleProductChange(key, productId) {
    const p = products.find((x) => x.id === productId);
    updateLine(key, { productId, sellPrice: p ? String(p.price) : '' });
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) { setReceiptFile(null); setReceiptPreview(''); return; }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result);
    reader.readAsDataURL(file);
  }

  const { subtotal, estCommission } = useMemo(() => {
    let sub = 0;
    let comm = 0;
    for (const l of lines) {
      const p = products.find((x) => x.id === l.productId);
      const qty = parseInt(l.qty, 10) || 0;
      const sellPrice = parseFloat(l.sellPrice) || 0;
      if (!p || !qty || !sellPrice) continue;
      sub += sellPrice * qty;
      const estimatedCost = (p.price || 0) * 0.6;
      comm += estimateCommission((sellPrice - estimatedCost) * qty);
    }
    return { subtotal: sub, estCommission: comm };
  }, [lines, products]);

  async function handleSubmit(e) {
    e.preventDefault();
    const items = lines
      .filter((l) => l.productId && parseInt(l.qty, 10) > 0)
      .map((l) => ({ id: l.productId, qty: parseInt(l.qty, 10), sellPrice: parseFloat(l.sellPrice) || 0 }));

    if (items.length === 0) {
      onToast('Debe añadir al menos un producto.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('items', JSON.stringify(items));
      fd.append('customer', JSON.stringify({ name: 'Venta Directa', phone: 'N/A', delivery: 'pickup' }));
      if (receiptFile) fd.append('receipt', receiptFile);

      const token = await user.getIdToken();
      const res = await fetch('/api/orders/report', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      onToast('¡Venta reportada con éxito!');
      onSubmitted();
      onClose();
    } catch (err) {
      onToast(`Error al reportar: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h2>Reportar Nueva Venta</h2>
          <button type="button" className="close-modal-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {lines.map((l) => (
              <div key={l.key} className="grid-form" style={{ gridTemplateColumns: '2fr 1fr 1fr auto', alignItems: 'end' }}>
                <label>
                  Producto
                  <select value={l.productId} onChange={(e) => handleProductChange(l.key, e.target.value)} required>
                    <option value="">Seleccione producto...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (Disp: {p.stock || 0})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad
                  <input
                    type="number" min="1" value={l.qty} required
                    onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                  />
                </label>
                <label>
                  Vendido en ({currency})
                  <input
                    type="number" min="0" step="0.01" value={l.sellPrice} required
                    onChange={(e) => updateLine(l.key, { sellPrice: e.target.value })}
                  />
                </label>
                <button
                  type="button" className="btn-ghost" style={{ padding: 8, color: 'var(--danger)' }}
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                >
                  ✖
                </button>
              </div>
            ))}
          </div>

          <button
            type="button" className="btn-ghost"
            style={{ marginTop: 16, width: '100%', border: '1.5px dashed var(--btn-ghost-border)', background: 'transparent' }}
            onClick={() => setLines((prev) => [...prev, newLine()])}
          >
            + Añadir otro producto
          </button>

          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>
              Foto de comprobante (opcional)
            </label>
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} />
            {receiptPreview && (
              <img
                src={receiptPreview} alt="Vista previa del comprobante"
                style={{ marginTop: 10, maxHeight: 140, borderRadius: 8, border: '1px solid var(--border)' }}
              />
            )}
          </div>

          <div style={{
            marginTop: 24, padding: 16, background: 'rgba(124,131,255,.05)',
            borderRadius: 8, border: '1px solid rgba(124,131,255,.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: 'var(--text-soft)' }}>
              <span>Subtotal Venta:</span>
              <strong style={{ color: 'var(--heading-color)' }}>{currency}{subtotal.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 'bold', color: 'var(--accent)' }}>
              <span>Comisión Estimada:</span>
              <strong title="Estimación basada en costo promedio. El monto final lo calcula el administrador con el costo real del lote.">
                ~ {currency}{estCommission.toFixed(2)}
              </strong>
            </div>
          </div>

          <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-solid" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar Reporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
