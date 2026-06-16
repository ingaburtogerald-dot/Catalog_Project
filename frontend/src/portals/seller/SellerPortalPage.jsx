import { useCallback, useEffect, useState } from 'react';
import PortalLayout from '../layout/PortalLayout';
import PortalToast from '../layout/PortalToast';
import NotificationBell from '../layout/NotificationBell';
import OrdersTab from './components/OrdersTab';
import ProductsTab from './components/ProductsTab';
import CommissionsTab from './components/CommissionsTab';
import MetricsDashboard from './components/MetricsDashboard';
import ReportSaleModal from './components/ReportSaleModal';
import { useSellerOrders } from './hooks/useSellerOrders';
import { useApprovalNotifications } from './hooks/useApprovalNotifications';
import { usePortalToast } from '../../hooks/usePortalToast';
import { fetchConfig, fetchProducts } from '../../lib/api';

const TABS = [
  { id: 'orders', label: 'Pedidos' },
  { id: 'products', label: 'Productos' },
  { id: 'commissions', label: 'Comisiones' },
];

export default function SellerPortalPage({ user, signOutPortal }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [products, setProducts] = useState([]);
  const [currency, setCurrency] = useState('C$');
  const [showReportModal, setShowReportModal] = useState(false);
  const { toast, toastMsg, toastShow } = usePortalToast();
  const { orders, loading, reload, updateStatus } = useSellerOrders(user);

  useEffect(() => {
    fetchConfig().then((cfg) => setCurrency(cfg.currency || 'C$')).catch(() => {});
    fetchProducts().then(setProducts).catch(() => {});
  }, []);

  const handleNewNotification = useCallback((n) => {
    if (n.status === 'approved') {
      toast(`✅ Venta aprobada — comisión: ${currency}${Number(n.commissionTotal).toFixed(2)}`, 5000);
    } else {
      toast(`❌ Venta rechazada${n.rejectionReason ? `: ${n.rejectionReason}` : ''}`, 5000);
    }
    reload();
  }, [toast, currency, reload]);

  const { items: notifications, unreadCount, markAllRead } = useApprovalNotifications(user, handleNewNotification);

  const approvedOrders = orders.filter((o) => o.status === 'approved');

  return (
    <PortalLayout
      title="Portal de Ventas"
      icon="💼"
      user={user}
      signOutPortal={signOutPortal}
      headerActions={(
        <>
          <button type="button" className="btn-solid" onClick={() => setShowReportModal(true)}>+ Reportar Venta</button>
          <NotificationBell items={notifications} unreadCount={unreadCount} onOpen={markAllRead} currency={currency} />
        </>
      )}
    >
      <MetricsDashboard orders={orders} currency={currency} />

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id} type="button" className={`tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <div className="panel">
          <h2>Pedidos recientes</h2>
          {loading ? <p className="muted-note">Cargando...</p> : (
            <OrdersTab orders={orders} currency={currency} onUpdateStatus={updateStatus} onToast={toast} />
          )}
        </div>
      )}
      {activeTab === 'products' && <ProductsTab products={products} currency={currency} />}
      {activeTab === 'commissions' && <CommissionsTab approvedOrders={approvedOrders} currency={currency} />}

      {showReportModal && (
        <ReportSaleModal
          products={products}
          user={user}
          currency={currency}
          onClose={() => setShowReportModal(false)}
          onSubmitted={reload}
          onToast={toast}
        />
      )}

      <PortalToast message={toastMsg} show={toastShow} />
    </PortalLayout>
  );
}
