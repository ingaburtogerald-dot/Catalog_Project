import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createOrder } from '../lib/api';

const CartContext = createContext(null);
const CART_KEY = 'gyro_cart';

const DEFAULT_CONFIG = {
  currency: 'C$',
  whatsapp: '50585944758',
  volume: { minQty: 3, percent: 10 },
  oneDriveSharingUrl: '',
  categories: [],
};

const keyOf = (id, variant) => `${id}|${variant || ''}`;

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((it) => it && it.id)
      .map((it) => ({
        id: String(it.id),
        name: String(it.name || 'Producto'),
        price: Number(it.price) || 0,
        img: String(it.img || ''),
        variant: String(it.variant || ''),
        qty: Math.max(1, parseInt(it.qty, 10) || 1),
      }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(loadCart);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const money = useCallback((n) => `${config.currency}${Number(n).toFixed(2)}`, [config.currency]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 2400);
  }, []);

  const add = useCallback((product, variant = '', qty = 1) => {
    const k = keyOf(product.id, variant);
    setCart((prev) => {
      const existing = prev.find((it) => keyOf(it.id, it.variant) === k);
      if (existing) {
        return prev.map((it) => (keyOf(it.id, it.variant) === k ? { ...it, qty: it.qty + qty } : it));
      }
      return [...prev, {
        id: String(product.id),
        name: String(product.name || 'Producto'),
        price: Number(product.price) || 0,
        img: String(product.img || ''),
        variant: String(variant || ''),
        qty: Math.max(1, qty),
      }];
    });
    toast(`${product.name}${variant ? ` (${variant})` : ''} agregado al carrito`);
  }, [toast]);

  const changeQty = useCallback((k, delta) => {
    setCart((prev) => prev
      .map((it) => (keyOf(it.id, it.variant) === k ? { ...it, qty: it.qty + delta } : it))
      .filter((it) => keyOf(it.id, it.variant) !== k || it.qty > 0));
  }, []);

  const removeKey = useCallback((k) => {
    setCart((prev) => prev.filter((it) => keyOf(it.id, it.variant) !== k));
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0;
    cart.forEach((it) => {
      const line = it.price * it.qty;
      subtotal += line;
      if (it.qty >= config.volume.minQty) discount += line * (config.volume.percent / 100);
    });
    return { subtotal, discount, total: subtotal - discount };
  }, [cart, config.volume]);

  const itemCount = useMemo(() => cart.reduce((n, it) => n + it.qty, 0), [cart]);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeCheckout = useCallback(() => setCheckoutOpen(false), []);

  const openCheckout = useCallback(() => {
    if (cart.length === 0) { toast('Tu carrito está vacío'); return; }
    setCartOpen(false);
    setCheckoutOpen(true);
  }, [cart.length, toast]);

  // Devuelve el pedido creado (incluye whatsappUrl) — el componente de checkout
  // decide cuándo abrir WhatsApp y cerrar los modales, igual que antes en cart.js.
  const submitCheckout = useCallback(async (customer) => {
    const order = await createOrder({
      items: cart.map(({ id, qty, variant }) => ({ id, qty, variant })),
      customer,
    });
    setCart([]);
    toast(`¡Pedido #${order.id.slice(0, 6)} enviado! Total ${money(order.total)}`);
    return order;
  }, [cart, money, toast]);

  const value = useMemo(() => ({
    cart, config, setConfig, totals, itemCount, money, toast,
    toastMsg, toastShow,
    add, changeQty, removeKey, submitCheckout,
    isCartOpen, openCart, closeCart,
    isCheckoutOpen, openCheckout, closeCheckout,
  }), [cart, config, totals, itemCount, money, toast, toastMsg, toastShow,
      add, changeQty, removeKey, submitCheckout, isCartOpen, openCart, closeCart,
      isCheckoutOpen, openCheckout, closeCheckout]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
