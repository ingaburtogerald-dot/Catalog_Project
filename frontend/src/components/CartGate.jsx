import { useLocation } from 'react-router-dom';
import CartDrawer from './CartDrawer';
import CheckoutModal from './CheckoutModal';

// El carrito de compras pertenece EXCLUSIVAMENTE a la tienda pública: el catálogo
// y la ficha de producto. Dentro de cualquier portal de administración
// (ventas, logística, usuarios, reportes, inventario, catálogo-admin) el botón
// flotante del carrito NO debe renderizarse.
const STORE_PATHS = ['/', '/producto.html'];

export default function CartGate() {
  const { pathname } = useLocation();
  if (!STORE_PATHS.includes(pathname)) return null;

  return (
    <>
      <CartDrawer />
      <CheckoutModal />
    </>
  );
}
