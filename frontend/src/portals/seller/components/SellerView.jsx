import { useState, useMemo } from 'react';
import { groupProducts } from '../utils/grouping';
import ReportSaleModal from './ReportSaleModal';

export default function SellerView({ products, orders, currency, reloadOrders, toast }) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const groupedProducts = useMemo(() => groupProducts(products), [products]);
  const approvedOrders = useMemo(() => orders.filter((o) => o.status === 'approved'), [orders]);

  const handleReportClick = (group) => {
    setSelectedProduct(group);
    setShowReportModal(true);
  };

  return (
    <div>
      <div className="admin-head">
        <h2>Catálogo Disponible</h2>
        <button type="button" className="btn-solid" onClick={() => { setSelectedProduct(null); setShowReportModal(true); }}>
          + Reportar Venta
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card card-glass">
          <div className="kpi-label">Ventas Aprobadas</div>
          <div className="kpi-value">{approvedOrders.length}</div>
        </div>
        <div className="kpi-card card-glass">
          <div className="kpi-label">Comisiones Generadas</div>
          <div className="kpi-value">
            {currency}{approvedOrders.reduce((sum, o) => sum + (Number(o.commissionTotal) || 0), 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '24px' }}>
        {groupedProducts.length === 0 ? (
          <p className="muted-note">No hay productos en el inventario.</p>
        ) : (
          groupedProducts.map((group) => (
            <div key={group.baseName} className="panel card-glass" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--heading-color)' }}>{group.baseName}</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: 'var(--accent)' }}>
                {currency}{Number(group.price).toFixed(2)}
              </p>
              
              <div style={{ flexGrow: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-soft)', marginBottom: '8px' }}>
                  Stock Disponible: <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>{group.totalStock} totales</span>
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: 'var(--text-soft)' }}>
                  {group.variants.map((v, i) => (
                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{v.variantName}</span>
                      <strong style={{ color: v.stock > 0 ? 'var(--text)' : 'var(--danger)' }}>{v.stock || 0}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                className="btn-ghost" 
                style={{ width: '100%', marginTop: '16px' }}
                onClick={() => handleReportClick(group)}
              >
                Vender
              </button>
            </div>
          ))
        )}
      </div>

      {showReportModal && (
        <ReportSaleModal
          onClose={() => setShowReportModal(false)}
          onSuccess={() => { setShowReportModal(false); reloadOrders(); toast('Reporte enviado a revisión'); }}
          currency={currency}
          preselectedProduct={selectedProduct}
          groupedProducts={groupedProducts}
        />
      )}
    </div>
  );
}
