const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const COL = config.collections.inventoryItems || 'inventory_items';

// GET /api/inventory/search?q=texto
// Búsqueda en memoria de items de inventario.
router.get('/search', requireAdmin, asyncHandler(async (req, res) => {
  const { q } = req.query;
  const snap = await db.collection(COL).get();
  
  let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (q) {
    const term = q.toLowerCase();
    items = items.filter(item => (item.name || '').toLowerCase().includes(term));
  }

  res.json(items);
}));

// GET /api/inventory/:catalogProductId
// Devuelve las variantes asociadas a un producto.
router.get('/:catalogProductId', asyncHandler(async (req, res) => {
  const snap = await db.collection(COL)
    .where('catalogProductId', '==', req.params.catalogProductId)
    .get();
  
  const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(items);
}));

// PUT /api/inventory/:id/link
router.put('/:id/link', requireAdmin, asyncHandler(async (req, res) => {
  const { catalogProductId } = req.body;
  const ref = db.collection(COL).doc(req.params.id);
  
  const doc = await ref.get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'Item de inventario no encontrado.' });
  }

  await ref.update({ catalogProductId, updatedAt: FieldValue.serverTimestamp() });
  res.json({ success: true, message: 'Item vinculado exitosamente.' });
}));

// POST /api/inventory (Sólo para testing/admin de crear inventario)
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, stock, attributes } = req.body;
  if (!name || stock == null) {
    return res.status(400).json({ error: 'Faltan campos (name, stock).' });
  }

  const doc = {
    name,
    stock: parseInt(stock, 10),
    attributes: attributes || {},
    catalogProductId: null,
    createdAt: FieldValue.serverTimestamp()
  };

  const ref = await db.collection(COL).add(doc);
  res.status(201).json({ id: ref.id, ...doc });
}));

module.exports = router;
