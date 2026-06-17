import { useEffect, useState } from 'react';
import PortalLayout from '../layout/PortalLayout';
import NotificationBell from '../layout/NotificationBell';
import { usePortalToast } from '../../hooks/usePortalToast';
import { useApprovalNotifications } from './hooks/useApprovalNotifications';
import { useSellerOrders } from './hooks/useSellerOrders';
import { fetchConfig, fetchProducts } from '../../lib/api';
import SellerView from './components/SellerView';
import AdminView from './components/AdminView';

export default function SalesPortal({ user, signOutPortal }) {
  const [currency, setCurrency] = useState('C$');
  const [products, setProducts] = useState([]);
  const { toast, toastMsg, toastShow } = usePortalToast();
  
  // Custom hooks for orders and notifications
  const { orders, reload, updateStatus } = useSellerOrders(user);
  
  const handleNewNotification = (n) => {
    if (n.status === 'approved') {
      toast(`✅ Venta aprobada — comisión: ${currency}${Number(n.commissionTotal).toFixed(2)}`, 5000);
    } else {
      toast(`❌ Venta rechazada${n.rejectionReason ? `: ${n.rejectionReason}` : ''}`, 5000);
    }
    reload();
  };

  const { items: notifications, unreadCount, markAllRead } = useApprovalNotifications(user, handleNewNotification);

  useEffect(() => {
    let active = true;
    fetchConfig().then((cfg) => { if (active) setCurrency(cfg.currency || 'C$'); }).catch(() => {});
    fetchProducts().then((res) => { if (active) setProducts(res); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const isAdmin = user.roles && (user.roles.includes('admin') || user.roles.includes('global_admin'));

  return (
    <PortalLayout
      title={isAdmin ? "Dashboard de Ventas" : "Portal de Ventas"}
      icon={isAdmin ? "📊" : "💼"}
      user={user}
      signOutPortal={signOutPortal}
      currentPortal="ventas"
      headerActions={(
        <>
          <NotificationBell items={notifications} unreadCount={unreadCount} onOpen={markAllRead} currency={currency} />
        </>
      )}
    >
      {/* Toast Notification global para el portal */}
      <div className={`toast ${toastShow ? 'show' : ''}`}>{toastMsg}</div>

      <div className="portal-theme">
        {isAdmin ? (
          <AdminView orders={orders} currency={currency} onStatusChange={updateStatus} />
        ) : (
          <SellerView user={user} products={products} orders={orders} currency={currency} reloadOrders={reload} toast={toast} />
        )}
      </div>
    </PortalLayout>
  );
}
