// Portal Gestión de Inventario: flujo de compras internacionales.
//   china    → registrado en China
//   pending  → reportado como recibido en Nicaragua, pendiente de aprobar
//   received → aprobado, en bodega listo para vender
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const COL = config.collections.inventoryItems;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// GET /api/inventory — todos los ítems del flujo (más reciente primero).
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(COL).orderBy('createdAt', 'desc').get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}));

// POST /api/inventory — registrar una compra en China (estado inicial 'china').
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { purchaseDate, lote, code, name, qty, costUnit, taxUnit, category } = req.body || {};
  if (!lote?.trim() || !code?.trim() || !name?.trim() || !category?.trim()) {
    return res.status(400).json({ error: 'Lote, código, nombre y categoría son obligatorios.' });
  }
  const qtyN = parseInt(qty, 10) || 0;
  if (qtyN <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0.' });

  const data = {
    purchaseDate: typeof purchaseDate === 'string' ? purchaseDate.trim() : '',
    lote: lote.trim(),
    code: code.trim(),
    name: name.trim(),
    category: category.trim(),
    qty: qtyN,
    costUnit: num(costUnit),
    taxUnit: num(taxUnit),
    salidas: 0,
    status: 'china',
    createdBy: req.user.email,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(COL).add(data);
  res.status(201).json({ id: ref.id, ...data });
}));

// PATCH /api/inventory/:id/report — reportar como recibido en Nicaragua (china → pending).
router.patch('/:id/report', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Ítem no encontrado.' });
  if (snap.data().status !== 'china') {
    return res.status(400).json({ error: 'Solo se puede reportar un ítem que está "En China".' });
  }
  await ref.update({
    status: 'pending',
    reportedBy: req.user.email,
    reportedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ id: req.params.id, status: 'pending' });
}));

// PATCH /api/inventory/:id/approve — aprobar ingreso a bodega (pending → received).
router.patch('/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const { entryDate, shippingUnit, category } = req.body || {};
  if (!entryDate?.trim()) return res.status(400).json({ error: 'La fecha de ingreso es obligatoria.' });
  if (!category?.trim()) return res.status(400).json({ error: 'La categoría es obligatoria.' });

  const ref = db.collection(COL).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Ítem no encontrado.' });
  if (snap.data().status !== 'pending') {
    return res.status(400).json({ error: 'Solo se puede aprobar un ítem "Pendiente de aprobar".' });
  }

  const update = {
    status: 'received',
    entryDate: entryDate.trim(),
    shippingUnit: num(shippingUnit),
    category: category.trim(),
    approvedBy: req.user.email,
    approvedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.update(update);
  res.json({ id: req.params.id, ...update });
}));

// PATCH /api/inventory/:id — editar campos (corrección de errores humanos).
// Acepta los campos iniciales (China) y/o los de aprobación (Bodega); actualiza
// solo los que vengan en el body.
router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Ítem no encontrado.' });

  const b = req.body || {};
  const update = {};
  // Campos iniciales (pestaña Compras en China)
  if (typeof b.purchaseDate === 'string') update.purchaseDate = b.purchaseDate.trim();
  if (typeof b.lote === 'string') update.lote = b.lote.trim();
  if (typeof b.code === 'string') update.code = b.code.trim();
  if (typeof b.name === 'string') update.name = b.name.trim();
  if (b.qty != null) update.qty = parseInt(b.qty, 10) || 0;
  if (b.costUnit != null) update.costUnit = num(b.costUnit);
  if (b.taxUnit != null) update.taxUnit = num(b.taxUnit);
  // Campos de aprobación (pestaña Bodega)
  if (typeof b.entryDate === 'string') update.entryDate = b.entryDate.trim();
  if (b.shippingUnit != null) update.shippingUnit = num(b.shippingUnit);
  if (typeof b.category === 'string') update.category = b.category.trim();

  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No hay campos válidos para actualizar.' });
  update.updatedAt = FieldValue.serverTimestamp();
  await ref.update(update);
  res.json({ id: req.params.id, ...update });
}));

// PATCH /api/inventory/:id/revert — deshacer ingreso a bodega (received → pending).
// Limpia los datos de aprobación para que vuelva a "Pendiente de aprobar".
router.patch('/:id/revert', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Ítem no encontrado.' });
  if (snap.data().status !== 'received') {
    return res.status(400).json({ error: 'Solo se puede revertir un ítem que está en Bodega (Recibido).' });
  }
  await ref.update({
    status: 'pending',
    entryDate: FieldValue.delete(),
    shippingUnit: FieldValue.delete(),
    category: FieldValue.delete(),
    revertedBy: req.user.email,
    revertedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ id: req.params.id, status: 'pending' });
}));

// DELETE /api/inventory/:id — eliminar un ítem del flujo.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Ítem no encontrado.' });
  await ref.delete();
  res.json({ ok: true, id: req.params.id });
}));

module.exports = router;
