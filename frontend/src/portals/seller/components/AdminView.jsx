import { useState, useMemo } from 'react';
import OrdersTab from './OrdersTab';

export default function AdminView({ orders, currency, onStatusChange }) {
  // Agrupar ventas por vendedor
  const performanceBySeller = useMemo(() => {
    const sellers = {};
    orders.forEach(o => {
      const seller = o.sellerName || o.sellerEmail || 'Desconocido';
      if (!sellers[seller]) {
        sellers[seller] = {
          name: seller,
          totalSales: 0,
          approvedSales: 0,
          totalRevenue: 0,
          totalCommission: 0
        };
      }
      
      sellers[seller].totalSales++;
      
      if (o.status === 'approved') {
        sellers[seller].approvedSales++;
        sellers[seller].totalRevenue += (Number(o.subtotal) || 0);
        sellers[seller].totalCommission += (Number(o.commissionTotal) || 0);
      }
    });
    
    return Object.values(sellers).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orders]);

  return (
    <div>
      <div className="admin-head">
        <h2>Dashboard de Rendimiento</h2>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card card-glass">
          <div className="kpi-label">Ventas Totales Reportadas</div>
          <div className="kpi-value">{orders.length}</div>
        </div>
        <div className="kpi-card card-glass">
          <div className="kpi-label">Ingresos Generados</div>
          <div className="kpi-value">
            {currency}{orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0).toFixed(2)}
          </div>
        </div>
        <div className="kpi-card card-glass">
          <div className="kpi-label">Comisiones a Pagar</div>
          <div className="kpi-value">
            {currency}{orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + (Number(o.commissionTotal) || 0), 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="panel card-glass" style={{ marginBottom: '24px' }}>
        <h3>Rendimiento por Vendedor</h3>
        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Reportes</th>
                <th>Ventas Aprobadas</th>
                <th>Ingresos Generados</th>
                <th>Comisión Generada</th>
              </tr>
            </thead>
            <tbody>
              {performanceBySeller.length === 0 ? (
                <tr><td colSpan={5} className="muted-note">No hay datos de rendimiento.</td></tr>
              ) : (
                performanceBySeller.map(seller => (
                  <tr key={seller.name}>
                    <td><strong>{seller.name}</strong></td>
                    <td>{seller.totalSales}</td>
                    <td><span className="status-pill status-delivered">{seller.approvedSales}</span></td>
                    <td><strong>{currency}{seller.totalRevenue.toFixed(2)}</strong></td>
                    <td>{currency}{seller.totalCommission.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista completa de órdenes para revisión administrativa */}
      <OrdersTab orders={orders} currency={currency} onUpdateStatus={onStatusChange} onToast={() => {}} isAdmin={true} />
    </div>
  );
}
