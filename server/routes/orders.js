// Rutas de pedidos: crear pedido (público) + listar/actualizar (admin/seller).
// IMPORTANTE: los totales se recalculan SIEMPRE en el servidor con los precios
// reales de Firestore. Nunca se confía en los precios que manda el cliente.
const router = require('express').Router();
const multer = require('multer');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireSeller, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');
const storage = require('../storage');

const PRODUCTS = config.collections.products;
const ORDERS = config.collections.orders;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

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

// GET /api/orders (admin/seller) — un vendedor solo ve sus propias órdenes.
router.get('/', requireSeller, asyncHandler(async (req, res) => {
  const isAdminLike = req.user.roles.includes('admin') || req.user.roles.includes('global_admin');

  let docs;
  if (isAdminLike) {
    const snap = await db.collection(ORDERS).orderBy('createdAt', 'desc').limit(100).get();
    docs = snap.docs;
  } else {
    // Filtro de un solo campo (sin orderBy) para evitar requerir índice compuesto.
    const snap = await db.collection(ORDERS).where('sellerEmail', '==', req.user.email).get();
    docs = snap.docs;
  }

  let orders = docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!isAdminLike) {
    orders.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    orders = orders.slice(0, 100);
  }
  res.json(orders);
}));

// PATCH /api/orders/:id  { status } (admin/seller) — pending | paid | delivered | cancelled
router.patch('/:id', requireSeller, asyncHandler(async (req, res) => {
  const valid = ['pending', 'paid', 'delivered', 'cancelled', 'rejected'];
  const { status } = req.body || {};
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status inválido. Use: ${valid.join(', ')}` });
  }
  const ref = db.collection(ORDERS).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Pedido no encontrado.' });
  
  const orderData = doc.data();
  if (orderData.status === 'approved' && status === 'rejected') {
     return res.status(400).json({ error: 'No puedes rechazar una venta que ya fue aprobada.' });
  }

  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  res.json({ id: req.params.id, status });
}));

function calculateCommission(netProfit) {
  if (netProfit <= 0) return 0;
  if (netProfit <= 300) return netProfit * 0.45;
  if (netProfit <= 600) return netProfit * 0.40;
  if (netProfit <= 900) return netProfit * 0.38;
  if (netProfit <= 1000) return netProfit * 0.35;
  if (netProfit <= 1400) return netProfit * 0.32;
  if (netProfit <= 1800) return netProfit * 0.30;
  return netProfit * 0.28;
}

// POST /api/orders/report (Para vendedores) — multipart/form-data con foto de comprobante opcional.
router.post('/report', requireSeller, upload.single('receipt'), asyncHandler(async (req, res) => {
  let items, customer;
  try {
    items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items;
    customer = typeof req.body.customer === 'string' ? JSON.parse(req.body.customer) : req.body.customer;
  } catch {
    return res.status(400).json({ error: 'Datos del reporte inválidos.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El reporte no tiene productos.' });
  }

  const lines = [];
  let subtotal = 0;

  for (const it of items) {
    const id = String(it.id || '');
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const sellPrice = Math.max(0, parseFloat(it.sellPrice) || 0); // Precio al que realmente lo vendió
    if (!id) continue;

    const doc = await db.collection(PRODUCTS).doc(id).get();
    if (!doc.exists) continue;

    const p = doc.data();
    const lineSubtotal = sellPrice * qty;
    
    subtotal += lineSubtotal;
    lines.push({ id: doc.id, name: p.name, price: sellPrice, suggestedPrice: p.price, qty, lineSubtotal });
  }

  if (lines.length === 0) {
    return res.status(400).json({ error: 'Ningún producto del reporte es válido.' });
  }

  // Foto de comprobante (opcional) — mismo patrón de upload que Gyro Logistics.
  let receiptUrl = '';
  if (req.file) {
    const sellerSlug = storage.sanitizePathSegment(req.user.name || req.user.email.split('@')[0]);
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    const filename = `${Date.now()}${ext}`;
    receiptUrl = await storage.uploadFile(req.file.buffer, `sales-receipts/${sellerSlug}`, filename, req.file.mimetype);
  }

  const order = {
    lines,
    subtotal,
    discount: 0,
    total: subtotal,
    customer: customer || null,
    status: 'pending_approval',
    channel: 'seller',
    sellerEmail: req.user.email,
    sellerName: req.user.name || req.user.email.split('@')[0],
    receiptUrl,
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection(ORDERS).add(order);
  order.id = ref.id;

  res.status(201).json({ id: ref.id, ...order });
}));

// POST /api/orders/:id/approve (Para Admins)
router.post('/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(ORDERS).doc(req.params.id);
  const docSnap = await ref.get();
  if (!docSnap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });
  
  const order = docSnap.data();
  if (order.status === 'approved') return res.status(400).json({ error: 'Esta venta ya fue aprobada.' });
  if (order.status === 'rejected') return res.status(400).json({ error: 'Esta venta fue rechazada.' });

  let totalRealCost = 0;
  let totalNetProfit = 0;
  let totalCommission = 0;

  const purchasesCol = config.collections.purchases;
  
  // Descontar inventario (FIFO) y calcular costo real
  for (const line of order.lines) {
    let qtyToDeduct = line.qty;
    let lineRealCost = 0;
    
    // Obtener compras aprobadas de este producto
    const pSnap = await db.collection(purchasesCol)
      .where('product', '==', line.name)
      .where('status', '==', 'Recibido')
      .where('approved', '==', true)
      .get();
      
    // Ordenar por fecha (las más antiguas primero, FIFO)
    const purchases = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    for (const pur of purchases) {
      if (qtyToDeduct <= 0) break;
      const available = pur.qty - (pur.qtySold || 0);
      if (available > 0) {
        const deduct = Math.min(qtyToDeduct, available);
        qtyToDeduct -= deduct;
        lineRealCost += (pur.unitCost * (pur.exchangeRate || 37.00)) * deduct;
        
        // Actualizar qtySold en la compra
        await db.collection(purchasesCol).doc(pur.id).update({
          qtySold: FieldValue.increment(deduct)
        });
      }
    }

    // Si aún falta deducir (vendió sin stock físico), usamos un costo estimado del último lote
    if (qtyToDeduct > 0 && purchases.length > 0) {
       const lastPur = purchases[purchases.length - 1];
       lineRealCost += (lastPur.unitCost * (lastPur.exchangeRate || 37.00)) * qtyToDeduct;
       // Registrar sobreventa en el lote más nuevo
       await db.collection(purchasesCol).doc(lastPur.id).update({
          qtySold: FieldValue.increment(qtyToDeduct)
       });
    }

    const netProfit = line.lineSubtotal - lineRealCost;
    const commission = calculateCommission(netProfit);

    totalRealCost += lineRealCost;
    totalNetProfit += netProfit;
    totalCommission += commission;
    
    // Guardar detalles en la línea
    line.realCost = lineRealCost;
    line.netProfit = netProfit;
    line.commission = commission;
  }

  await ref.update({
    lines: order.lines,
    status: 'approved',
    realCostTotal: totalRealCost,
    netProfitTotal: totalNetProfit,
    commissionTotal: totalCommission,
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: req.user.email
  });

  res.json({ ok: true, commissionTotal: totalCommission });
}));

// POST /api/orders/:id/reject (Para Admins) — simétrico a /approve.
router.post('/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  const ref = db.collection(ORDERS).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Venta no encontrada.' });

  const order = doc.data();
  if (order.status === 'approved') {
    return res.status(400).json({ error: 'Esta venta ya fue aprobada, no se puede rechazar.' });
  }

  await ref.update({
    status: 'rejected',
    rejectionReason: String(reason || '').trim(),
    rejectedAt: FieldValue.serverTimestamp(),
    rejectedBy: req.user.email,
  });

  res.json({ ok: true });
}));

// GET /api/orders/notifications?since=<ISO> (Para vendedores)
// Devuelve solo las órdenes propias aprobadas/rechazadas después de `since`, para polling liviano.
router.get('/notifications', requireSeller, asyncHandler(async (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : new Date(0);

  // Filtro de un solo campo (sin orderBy) para evitar requerir índice compuesto.
  const snap = await db.collection(ORDERS).where('sellerEmail', '==', req.user.email).get();

  const notifications = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((o) => o.status === 'approved' || o.status === 'rejected')
    .filter((o) => {
      const changedAt = (o.approvedAt || o.rejectedAt)?.toDate?.();
      return changedAt && changedAt > since;
    })
    .map((o) => ({
      id: o.id,
      status: o.status,
      commissionTotal: o.commissionTotal || 0,
      rejectionReason: o.rejectionReason || '',
      productNames: o.lines.map((l) => l.name).join(', '),
      changedAt: (o.approvedAt || o.rejectedAt).toDate().toISOString(),
    }))
    .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

  res.json(notifications);
}));

module.exports = router;
