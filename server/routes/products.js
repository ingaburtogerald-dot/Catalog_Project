// Rutas de productos: lectura pública + CRUD protegido (admin).
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler, sanitizeProduct } = require('../utils');
const catalogRouter = require('./catalog');

const COL = config.collections.products;

// ---------- Público ----------

let stockCache = null;
let stockCacheTime = 0;
const CACHE_TTL = 10000; // 10 seconds

// GET /api/products?category=in-ear&q=texto
router.get('/', asyncHandler(async (req, res) => {
  const { category, q, all, deleted } = req.query;

  let query = db.collection(COL);
  const snap = await query.get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Filtrar Papelera
  if (deleted === 'true') {
    items = items.filter(p => p.deletedAt != null);
  } else {
    items = items.filter(p => p.deletedAt == null);
  }

  // Calcular stock y códigos desde purchases con caché
  if (!stockCache || Date.now() - stockCacheTime > CACHE_TTL) {
    const purSnap = await db.collection(config.collections.purchases).get();
    const stocks = {};
    const codes = {};
    purSnap.docs.forEach(doc => {
      const p = doc.data();
      if (p.product) {
        const prodKey = String(p.product).trim().toLowerCase();
        if (p.status === 'Recibido' && p.qty) {
          const available = Math.max(0, p.qty - (p.qtySold || 0));
          stocks[prodKey] = (stocks[prodKey] || 0) + available;
        }
        if (p.code) {
          codes[prodKey] = String(p.code).trim();
        }
      }
    });
    stockCache = { stocks, codes };
    stockCacheTime = Date.now();
  }

  items.forEach(item => {
    // Las compras (purchases) guardan el nombre del producto en "p.product", no el ID.
    // Por retrocompatibilidad, verificamos tanto por item.name como por item.id.
    const keyName = String(item.name || '').trim().toLowerCase();
    const keyId = String(item.id || '').trim().toLowerCase();
    item.stock = stockCache.stocks[keyName] || stockCache.stocks[keyId] || 0;
    item.code = stockCache.codes[keyName] || stockCache.codes[keyId] || '';
  });

  // Filtros de categoría y búsqueda
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
  await catalogRouter.reconcileVariants().catch(console.error);
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
  await catalogRouter.reconcileVariants().catch(console.error);
  res.json({ id: req.params.id, ...data });
}));

// DELETE /api/products/:id (Soft Delete)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  await ref.update({ deletedAt: FieldValue.serverTimestamp() });
  await catalogRouter.reconcileVariants().catch(console.error);
  res.json({ ok: true, id: req.params.id, softDeleted: true });
}));

// POST /api/products/:id/restore
router.post('/:id/restore', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  await ref.update({ deletedAt: FieldValue.delete() });
  await catalogRouter.reconcileVariants().catch(console.error);
  res.json({ ok: true, id: req.params.id, restored: true });
}));

// DELETE /api/products/:id/hard (Hard Delete + Cascade)
router.delete('/:id/hard', requireAdmin, asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const ref = db.collection(COL).doc(productId);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Producto no encontrado.' });

  // Borrado en cascada: remover de los catálogos vinculados
  const catalogSnap = await db.collection(config.collections.catalog).get();
  const batch = db.batch();
  
  catalogSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.variants && Array.isArray(data.variants) && data.variants.includes(productId)) {
      const updatedVariants = data.variants.filter(v => v !== productId);
      batch.update(doc.ref, { variants: updatedVariants });
    }
  });

  batch.delete(ref);
  await batch.commit();
  await catalogRouter.reconcileVariants().catch(console.error);

  res.json({ ok: true, id: productId, hardDeleted: true });
}));

module.exports = router;
