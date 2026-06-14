// Rutas de productos: lectura pública + CRUD protegido (admin).
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler, sanitizeProduct } = require('../utils');

const COL = config.collections.products;

// ---------- Público ----------

// GET /api/products?category=in-ear&q=texto
router.get('/', asyncHandler(async (req, res) => {
  const snap = await db.collection(COL).get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const { category, q } = req.query;
  if (category && category !== 'all') {
    items = items.filter((p) => p.category === category);
  }
  if (q) {
    const term = String(q).toLowerCase();
    items = items.filter((p) => `${p.name} ${p.desc}`.toLowerCase().includes(term));
  }
  // Orden estable por nombre (createdAt puede no existir en datos viejos)
  items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  res.json(items);
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await db.collection(COL).doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json({ id: doc.id, ...doc.data() });
}));

// ---------- Admin (protegido) ----------

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
