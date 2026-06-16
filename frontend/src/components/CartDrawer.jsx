import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { resolveImageUrl } from '../lib/resolveImageUrl';

const keyOf = (id, variant) => `${id}|${variant || ''}`;

export default function CartDrawer() {
  const { cart, config, money, totals, changeQty, removeKey,
    isCartOpen, closeCart, openCheckout } = useCart();

  return (
    <>
      <CartFab />
      <div className="overlay" hidden={!isCartOpen} onClick={closeCart}></div>
      <aside className={`cart-drawer${isCartOpen ? ' open' : ''}`} aria-label="Carrito de compras" aria-hidden={!isCartOpen}>
        <div className="cart-header">
          <h2><i className="fa-solid fa-cart-shopping"></i> Tu carrito</h2>
          <button className="icon-btn" aria-label="Cerrar carrito" onClick={closeCart}>✕</button>
        </div>

        <div className="cart-body">
          {cart.length === 0 ? (
            <p className="cart-empty">Tu carrito está vacío 🛒<br />Agregá productos del catálogo.</p>
          ) : (
            cart.map((it) => {
              const k = keyOf(it.id, it.variant);
              const detailLink = `/producto.html?id=${encodeURIComponent(it.id)}`;
              return (
                <div className="cart-item" key={k}>
                  <Link to={detailLink}>
                    <img src={resolveImageUrl(it.img, config.oneDriveSharingUrl)} alt={it.name} />
                  </Link>
                  <div>
                    <p className="cart-item-name"><Link to={detailLink}>{it.name}</Link></p>
                    {it.variant && <p className="cart-item-variant">{it.variant}</p>}
                    <p className="cart-item-price">{money(it.price)}</p>
                    <div className="qty">
                      <button aria-label="Quitar uno" onClick={() => changeQty(k, -1)}>−</button>
                      <span>{it.qty}</span>
                      <button aria-label="Agregar uno" onClick={() => changeQty(k, +1)}>+</button>
                    </div>
                  </div>
                  <button className="cart-remove" aria-label={`Eliminar ${it.name}`} onClick={() => removeKey(k)}>Quitar</button>
                </div>
              );
            })
          )}
        </div>

        <div className="cart-footer">
          {totals.discount > 0 && (
            <div className="cart-row">
              <span>Descuento por volumen</span>
              <span>- {money(totals.discount)}</span>
            </div>
          )}
          <div className="cart-row cart-total">
            <span>Total</span>
            <span>{money(totals.total)}</span>
          </div>
          <button className="btn btn--checkout" onClick={openCheckout}>
            <i className="fa-brands fa-whatsapp"></i> Finalizar pedido por WhatsApp
          </button>
        </div>
      </aside>
    </>
  );
}

function CartFab() {
  const { itemCount, openCart } = useCart();
  return (
    <button className="cart-fab" aria-label="Ver carrito" onClick={openCart}>
      <i className="fa-solid fa-cart-shopping"></i>
      <span className={`cart-badge${itemCount > 0 ? ' show' : ''}`} aria-live="polite">{itemCount}</span>
    </button>
  );
}
