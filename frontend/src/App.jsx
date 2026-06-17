import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './auth/AuthContext';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import LoginPage from './pages/LoginPage';
import CartGate from './components/CartGate';
import Toast from './components/Toast';
import ProtectedRoute from './router/ProtectedRoute';
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
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/producto.html" element={<ProductDetail />} />
            <Route
              path="/vendedor.html"
              element={
                <ProtectedRoute allowedRoles={['seller', 'cashier', 'admin', 'global_admin']}>
                  {({ user, signOutPortal }) => <SalesPortal user={user} signOutPortal={signOutPortal} />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/catalogo-admin.html"
              element={
                <ProtectedRoute allowedRoles={['admin', 'global_admin']}>
                  {({ user, signOutPortal }) => <CatalogAdminPanel user={user} signOutPortal={signOutPortal} />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventario"
              element={
                <ProtectedRoute allowedRoles={['admin', 'global_admin']}>
                  {({ user, signOutPortal }) => <InventoryManagement user={user} signOutPortal={signOutPortal} />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/gyrologistics"
              element={
                <ProtectedRoute allowedRoles={['admin', 'global_admin', 'logistics_admin', 'logistics_customer']}>
                  {({ user, signOutPortal }) => <GyroLogistics user={user} signOutPortal={signOutPortal} />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/reportes"
              element={
                <ProtectedRoute allowedRoles={['admin', 'global_admin']}>
                  {({ user, signOutPortal }) => <Reports user={user} signOutPortal={signOutPortal} />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute allowedRoles={['admin', 'global_admin']}>
                  {({ user, signOutPortal }) => <UserManagement user={user} signOutPortal={signOutPortal} />}
                </ProtectedRoute>
              }
            />
          </Routes>
          <CartGate />
          <Toast />
        </AuthProvider>
      </BrowserRouter>
    </CartProvider>
  );
}
