// Rutas de pedidos: crear pedido (público) + listar/actualizar (admin/seller).
// IMPORTANTE: los totales se recalculan SIEMPRE en el servidor con los precios
// reales de Firestore. Nunca se confía en los precios que manda el cliente.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireSeller } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const PRODUCTS = config.collections.products;
const ORDERS = config.collections.orders;

// Valida y normaliza los datos del cliente.
function sanitizeCustomer(c) {
  if (!c || typeof c !== 'object') return { error: 'Faltan los datos del cliente.' };
  const name = String(c.name || '').trim();
  const phone = String(c.phone || '').trim();
  const delivery = c.delivery === 'shipping' ? 'shipping' : 'pickup';
  const address = String(c.address || '').trim();
  const note = String(c.note || '').trim();
  if (!name) return { error: 'El nombre del cliente es obligatorio.' };
  if (!phone) return { error: 'El teléfono del cliente es obligatorio.' };
  if (delivery === 'shipping' && !address) {
    return { error: 'La dirección es obligatoria para envío a domicilio.' };
  }
  return { customer: { name, phone, delivery, address, note } };
}

function buildWhatsappUrl(order) {
  const c = order.customer;
  let msg = '¡Hola Gyro Store! 👋 Quiero confirmar este pedido:\n\n';
  msg += `👤 ${c.name}\n📞 ${c.phone}\n`;
  msg += c.delivery === 'shipping' ? `🚚 Envío a: ${c.address}\n` : '🏬 Retiro en tienda\n';
  if (c.note) msg += `📝 ${c.note}\n`;
  msg += '\nProductos:\n';
  order.lines.forEach((l) => {
    const v = l.variant ? ` (${l.variant})` : '';
    msg += `• ${l.name}${v} x${l.qty} — ${config.currency}${l.lineSubtotal.toFixed(2)}\n`;
  });
  msg += `\nSubtotal: ${config.currency}${order.subtotal.toFixed(2)}`;
  if (order.discount > 0) msg += `\nDescuento por volumen: -${config.currency}${order.discount.toFixed(2)}`;
  msg += `\n*Total: ${config.currency}${order.total.toFixed(2)}*`;
  msg += `\n\nN° de pedido: ${order.id}`;
  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`;
}

// POST /api/orders  { items: [{ id, qty }], customer?: {...} }
router.post('/', asyncHandler(async (req, res) => {
  const { items, customer } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El pedido no tiene productos.' });
  }

  // Valida los datos del cliente antes de seguir.
  const custResult = sanitizeCustomer(customer);
  if (custResult.error) {
    return res.status(400).json({ error: custResult.error });
  }

  // Lee los productos reales de Firestore y arma las líneas con precios de confianza.
  const lines = [];
  let subtotal = 0;
  let discount = 0;

  for (const it of items) {
    const id = String(it.id || '');
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const variant = typeof it.variant === 'string' ? it.variant.trim() : '';
    if (!id) continue;

    const doc = await db.collection(PRODUCTS).doc(id).get();
    if (!doc.exists) continue;

    const p = doc.data();
    const lineSubtotal = p.price * qty;
    
    // Calcular escala de precios por volumen
    let lineDiscount = 0;
    if (qty >= config.volume.minQty) {
      // Soporte para porcentajes globales o específicos si se implementan a futuro
      lineDiscount = lineSubtotal * (config.volume.percent / 100);
    }

    subtotal += lineSubtotal;
    discount += lineDiscount;
    lines.push({ id: doc.id, name: p.name, price: p.price, qty, variant, lineSubtotal });
  }

  if (lines.length === 0) {
    return res.status(400).json({ error: 'Ningún producto del pedido es válido.' });
  }

  const order = {
    lines,
    subtotal,
    discount,
    total: subtotal - discount,
    customer: custResult.customer,
    status: 'pending',
    channel: 'whatsapp',
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection(ORDERS).add(order);
  order.id = ref.id;

  res.status(201).json({
    id: ref.id,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    whatsappUrl: buildWhatsappUrl(order),
  });
}));

// GET /api/orders (admin/seller)
router.get('/', requireSeller, asyncHandler(async (req, res) => {
  const snap = await db.collection(ORDERS).orderBy('createdAt', 'desc').limit(100).get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}));

// PATCH /api/orders/:id  { status } (admin/seller) — pending | paid | delivered | cancelled
router.patch('/:id', requireSeller, asyncHandler(async (req, res) => {
  const valid = ['pending', 'paid', 'delivered', 'cancelled'];
  const { status } = req.body || {};
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status inválido. Use: ${valid.join(', ')}` });
  }
  const ref = db.collection(ORDERS).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Pedido no encontrado.' });
  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  res.json({ id: req.params.id, status });
}));

module.exports = router;
