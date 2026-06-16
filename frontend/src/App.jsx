import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import Toast from './components/Toast';
import PortalAuthGate from './portals/layout/PortalAuthGate';
import SellerPortalPage from './portals/seller/SellerPortalPage';

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/producto.html" element={<ProductDetail />} />
          <Route
            path="/vendedor.html"
            element={
              <PortalAuthGate allowedRoles={['seller', 'cashier']}>
                {({ user, signOutPortal }) => <SellerPortalPage user={user} signOutPortal={signOutPortal} />}
              </PortalAuthGate>
            }
          />
        </Routes>
        <CartDrawer />
        <CheckoutModal />
        <Toast />
      </BrowserRouter>
    </CartProvider>
  );
}
