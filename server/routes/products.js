// Rutas de productos: lectura pública + CRUD protegido (admin).
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler, sanitizeProduct } = require('../utils');

const COL = config.collections.products;

// ---------- Público ----------

let stockCache = null;
let stockCacheTime = 0;
const CACHE_TTL = 10000; // 10 seconds

// GET /api/products?category=in-ear&q=texto
router.get('/', asyncHandler(async (req, res) => {
  const snap = await db.collection(COL).get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Calcular stock desde purchases con caché
  if (!stockCache || Date.now() - stockCacheTime > CACHE_TTL) {
    const purSnap = await db.collection(config.collections.purchases).where('status', '==', 'Recibido').get();
    const stocks = {};
    purSnap.docs.forEach(doc => {
      const p = doc.data();
      if (p.product && p.qty) {
        const available = Math.max(0, p.qty - (p.qtySold || 0));
        stocks[p.product] = (stocks[p.product] || 0) + available;
      }
    });
    stockCache = stocks;
    stockCacheTime = Date.now();
  }

  items.forEach(item => {
    item.stock = stockCache[item.id] || 0;
  });

  // Filtros de categoría y búsqueda
  const { category, q, all } = req.query;
  if (category && category !== 'all') {
    items = items.filter((p) => p.category === category);
  }
  if (q) {
    const term = String(q).toLowerCase();
    items = items.filter((p) => `${p.name} ${p.desc}`.toLowerCase().includes(term));
  }
  
  // Filtrar stock si no es "all"
  if (all !== 'true') {
    items = items.filter(p => p.stock > 0);
  }

  // Orden estable por 'order' y luego por nombre
  items.sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 999999;
    const orderB = typeof b.order === 'number' ? b.order : 999999;
    if (orderA !== orderB) return orderA - orderB;
    return String(a.name).localeCompare(String(b.name));
  });
  
  res.json(items);
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await db.collection(COL).doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json({ id: doc.id, ...doc.data() });
}));

// ---------- Admin (protegido) ----------

// PATCH /api/products/reorder
router.patch('/reorder', requireAdmin, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Falta arreglo de items [{id, order}].' });
  }

  const batch = db.batch();
  items.forEach((item) => {
    if (item.id && typeof item.order === 'number') {
      const ref = db.collection(COL).doc(item.id);
      batch.update(ref, { order: item.order, updatedAt: FieldValue.serverTimestamp() });
    }
  });

  await batch.commit();
  res.json({ ok: true });
}));

// POST /api/products
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const data = sanitizeProduct(req.body);
  if (!data.name || !data.category || data.price == null) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: name, category, price.' });
  }
  data.createdAt = FieldValue.serverTimestamp();
  const ref = await db.collection(COL).add(data);
  res.status(201).json({ id: ref.id, ...data });
}));

// PUT /api/products/:id
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Producto no encontrado.' });

  const data = sanitizeProduct(req.body);
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar.' });
  }
  data.updatedAt = FieldValue.serverTimestamp();
  await ref.update(data);
  res.json({ id: req.params.id, ...data });
}));

// DELETE /api/products/:id
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  await ref.delete();
  res.json({ ok: true, id: req.params.id });
}));

module.exports = router;
