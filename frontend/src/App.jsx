import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import LoginPage from './pages/LoginPage';
import CartGate from './components/CartGate';
import Toast from './components/Toast';
import PortalAuthGate from './portals/layout/PortalAuthGate';
import SalesPortal from './portals/seller/SalesPortal';
import CatalogAdminPanel from './portals/admin/CatalogAdminPanel';
import InventoryManagement from './portals/inventory/InventoryManagement';
import GyroLogistics from './portals/logistics/GyroLogistics';
import Reports from './portals/reports/Reports';
import UserManagement from './portals/users/UserManagement';

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/producto.html" element={<ProductDetail />} />
          <Route
            path="/vendedor.html"
            element={
              <PortalAuthGate allowedRoles={['seller', 'cashier', 'admin', 'global_admin']}>
                {({ user, signOutPortal }) => <SalesPortal user={user} signOutPortal={signOutPortal} />}
              </PortalAuthGate>
            }
          />
          <Route
            path="/catalogo-admin.html"
            element={
              <PortalAuthGate allowedRoles={['admin', 'global_admin']}>
                {({ user, signOutPortal }) => <CatalogAdminPanel user={user} signOutPortal={signOutPortal} />}
              </PortalAuthGate>
            }
          />
          <Route
            path="/inventario"
            element={
              <PortalAuthGate allowedRoles={['admin', 'global_admin']}>
                {({ user, signOutPortal }) => <InventoryManagement user={user} signOutPortal={signOutPortal} />}
              </PortalAuthGate>
            }
          />
          <Route
            path="/gyrologistics"
            element={
              <PortalAuthGate allowedRoles={['admin', 'global_admin', 'logistics_admin', 'logistics_customer']}>
                {({ user, signOutPortal }) => <GyroLogistics user={user} signOutPortal={signOutPortal} />}
              </PortalAuthGate>
            }
          />
          <Route
            path="/reportes"
            element={
              <PortalAuthGate allowedRoles={['admin', 'global_admin']}>
                {({ user, signOutPortal }) => <Reports user={user} signOutPortal={signOutPortal} />}
              </PortalAuthGate>
            }
          />
          <Route
            path="/usuarios"
            element={
              <PortalAuthGate allowedRoles={['admin', 'global_admin']}>
                {({ user, signOutPortal }) => <UserManagement user={user} signOutPortal={signOutPortal} />}
              </PortalAuthGate>
            }
          />
        </Routes>
        <CartGate />
        <Toast />
      </BrowserRouter>
    </CartProvider>
  );
}
