// Rutas de compras de China: organizadas como en el Excel del usuario.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const COL = config.collections.purchases;

// GET /api/purchases
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(COL).get();
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Ordenar por fecha (desc), luego lote (desc), luego código (asc) con ordenamiento natural
  list.sort((a, b) => {
    const dateComp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateComp !== 0) return dateComp;
    const loteComp = String(b.lote || '').localeCompare(String(a.lote || ''), undefined, { numeric: true, sensitivity: 'base' });
    if (loteComp !== 0) return loteComp;
    return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
  });
  
  res.json(list);
}));

// POST /api/purchases
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { lote, date, exchangeRate, status, items } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debes añadir al menos un artículo a la compra.' });
  }

  const rate = Number(exchangeRate) || 37.00;
  const targetLote = String(lote || '').trim() || 'LT';
  const targetDate = String(date || '').trim() || new Date().toISOString().split('T')[0];
  const targetStatus = String(status || 'Pedido').trim();

  // Validar unicidad de códigos en compras
  const codesToCheck = items.map(item => String(item.code || '').trim()).filter(Boolean);
  if (codesToCheck.length > 0) {
    const hasDuplicates = codesToCheck.some((val, i) => codesToCheck.indexOf(val) !== i);
    if (hasDuplicates) {
      return res.status(400).json({ error: 'No se permiten códigos duplicados en la misma transacción.' });
    }

    const purchasesSnap = await db.collection(COL).get();
    const existingCodes = purchasesSnap.docs.map(d => String(d.data().code || '').trim().toLowerCase()).filter(Boolean);
    for (const code of codesToCheck) {
      if (existingCodes.includes(code.toLowerCase())) {
        return res.status(400).json({ error: `El código "${code}" ya está registrado en otra compra. Debe ser único.` });
      }
    }
  }

  // Obtener catálogo actual de productos para evitar duplicados
  const prodCol = config.collections.products;
  const prodSnap = await db.collection(prodCol).get();
  const existingProducts = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const existingNames = new Set(existingProducts.map(p => String(p.name).toLowerCase().trim()));

  const promises = items.map(async (item) => {
    const code = String(item.code || '').trim();
    const product = String(item.product || '').trim() || 'Artículo sin nombre';
    const qty = Math.max(1, parseInt(item.qty) || 1);
    const cost = Math.max(0, parseFloat(item.cost) || 0);
    const tax = Math.max(0, parseFloat(item.tax) || 0);
    
    const unitCost = cost + tax;
    const totalUsd = qty * unitCost;
    const totalNio = totalUsd * rate;

    const doc = {
      lote: targetLote,
      code,
      date: targetDate,
      product,
      qty,
      cost,
      tax,
      unitCost,
      totalUsd,
      totalNio,
      exchangeRate: rate,
      status: targetStatus,
      approved: false,
      notes: String(req.body.notes || '').trim(),
      createdAt: FieldValue.serverTimestamp()
    };

    // Registrar la compra en Firestore
    const ref = await db.collection(COL).add(doc);

    // Alimentar catálogo dinámicamente si el producto no existe
    const productNormalized = product.toLowerCase().trim();
    if (!existingNames.has(productNormalized)) {
      // Sugerir un precio de venta con un 40% de ganancia aproximada
      const suggestedPriceNio = Math.ceil(unitCost * rate * 1.40);
      
      const newProductDoc = {
        name: product,
        category: 'in-ear', // Por defecto
        price: suggestedPriceNio,
        img: '', // Sin imagen inicial, para que lo completen
        desc: `Importado en Lote ${targetLote}. Costo unitario: $${unitCost.toFixed(2)} USD.`,
        variants: [],
        specs: [],
        createdAt: FieldValue.serverTimestamp()
      };
      
      await db.collection(prodCol).add(newProductDoc);
      // Añadir al set para evitar crear el mismo producto múltiples veces en la misma petición batch
      existingNames.add(productNormalized);
    }

    return { id: ref.id, ...doc };
  });

  const created = await Promise.all(promises);
  res.status(201).json(created);
}));

// PUT /api/purchases/:id
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  const docSnap = await ref.get();
  if (!docSnap.exists) {
    return res.status(404).json({ error: 'Registro de compra no encontrado.' });
  }
  const existingData = docSnap.data();

  const { lote, code, date, receiveDate, product, qty, cost, tax, shipping, exchangeRate, status, notes, approved } = req.body;

  const cleanCode = String(code || '').trim();
  if (cleanCode) {
    const snap = await db.collection(COL).get();
    const anotherWithSameCode = snap.docs.some(d => d.id !== req.params.id && String(d.data().code || '').trim().toLowerCase() === cleanCode.toLowerCase());
    if (anotherWithSameCode) {
      return res.status(400).json({ error: `El código "${cleanCode}" ya está registrado en otra compra. Debe ser único.` });
    }
  }

  const rate = Number(exchangeRate) || 37.00;
  const targetQty = Math.max(1, parseInt(qty) || 1);
  const targetCost = Math.max(0, parseFloat(cost) || 0);
  const targetTax = Math.max(0, parseFloat(tax) || 0);
  const targetShipping = Math.max(0, parseFloat(shipping) || 0);
  
  const unitCost = targetCost + targetTax + targetShipping;
  const totalUsd = targetQty * unitCost;
  const totalNio = totalUsd * rate;

  const targetStatus = String(status || 'Pedido').trim();
  let targetApproved = false;
  if (targetStatus === 'Recibido') {
    if (approved !== undefined) {
      targetApproved = Boolean(approved);
    } else if (existingData.status === 'Recibido') {
      targetApproved = existingData.approved !== undefined ? existingData.approved : false;
    } else {
      targetApproved = false;
    }
  }

  const doc = {
    lote: String(lote || '').trim() || 'LT',
    code: String(code || '').trim(),
    date: String(date || '').trim() || new Date().toISOString().split('T')[0],
    receiveDate: receiveDate !== undefined ? String(receiveDate || '').trim() : existingData.receiveDate || null,
    product: String(product || '').trim() || 'Artículo sin nombre',
    qty: targetQty,
    cost: targetCost,
    tax: targetTax,
    shipping: targetShipping,
    unitCost,
    totalUsd,
    totalNio,
    exchangeRate: rate,
    status: targetStatus,
    approved: targetApproved,
    notes: notes !== undefined ? String(notes || '').trim() : undefined,
    updatedAt: FieldValue.serverTimestamp()
  };

  await ref.update(doc);
  res.json({ id: req.params.id, ...doc });
}));

// DELETE /api/purchases/:id
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COL).doc(req.params.id);
  if (!(await ref.get()).exists) {
    return res.status(404).json({ error: 'Registro de compra no encontrado.' });
  }
  await ref.delete();
  res.json({ ok: true, id: req.params.id });
}));

module.exports = router;
