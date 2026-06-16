const router = require('express').Router();
const multer = require('multer');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');
const storage = require('../storage');

const CATALOG = config.collections.catalog || 'catalog';
const PRODUCTS = config.collections.products;
const ORDERS = config.collections.orders;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// GET /api/catalog
router.get('/', asyncHandler(async (req, res) => {
  let query = db.collection(CATALOG);
  
  if (req.query.isPromo === 'true') {
    query = query.where('isPromo', '==', true);
  }
  if (req.query.category && req.query.category !== 'all') {
    query = query.where('category', '==', req.query.category);
  }

  const snap = await query.get();
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Sort by order ascending in memory to avoid missing index errors
  items.sort((a, b) => (a.order || 0) - (b.order || 0));
  
  res.json(items);
}));

// GET /api/catalog/top-sellers
router.get('/top-sellers', asyncHandler(async (req, res) => {
  // 1. Obtener ordenes aprobadas/entregadas
  const ordersSnap = await db.collection(ORDERS)
    .where('status', 'in', ['approved', 'delivered'])
    .get();
    
  const salesByVariantId = {};
  
  // 2. Agregar cantidades vendidas por ID de variante (producto físico)
  ordersSnap.docs.forEach(doc => {
    const order = doc.data();
    if (order.lines) {
      order.lines.forEach(line => {
        if (line.id) {
          salesByVariantId[line.id] = (salesByVariantId[line.id] || 0) + (line.qty || 0);
        }
      });
    }
  });

  // 3. Obtener el catálogo completo para cruzar datos
  const catalogSnap = await db.collection(CATALOG).get();
  const catalogItems = catalogSnap.docs.map(d => ({ id: d.id, ...d.data(), totalSold: 0 }));

  // 4. Mapear ventas de variantes a su producto padre en el catálogo
  for (const [variantId, qty] of Object.entries(salesByVariantId)) {
    const parentCatalog = catalogItems.find(c => c.variants && c.variants.includes(variantId));
    if (parentCatalog) {
      parentCatalog.totalSold += qty;
    }
  }

  // 5. Ordenar por más vendidos y tomar el Top 10
  const topSellers = catalogItems
    .filter(c => c.totalSold > 0)
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 10);

  res.json(topSellers);
}));

// POST /api/catalog
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, category, desc, variants, isPromo, images } = req.body;
  
  if (!name || !category) {
    return res.status(400).json({ error: 'Nombre y categoría son requeridos.' });
  }

  let maxPrice = 0;
  
  // Calcular precio máximo iterando sobre las variantes en el inventario
  if (Array.isArray(variants) && variants.length > 0) {
    for (const variantId of variants) {
      const doc = await db.collection(PRODUCTS).doc(variantId).get();
      if (doc.exists) {
        const pPrice = doc.data().price || 0;
        if (pPrice > maxPrice) {
          maxPrice = pPrice;
        }
      }
    }
  }

  const catalogItem = {
    name: String(name).trim(),
    category: String(category).trim(),
    desc: String(desc || '').trim(),
    variants: Array.isArray(variants) ? variants : [],
    images: Array.isArray(images) ? images : [],
    isPromo: Boolean(isPromo),
    price: maxPrice,
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection(CATALOG).add(catalogItem);
  res.status(201).json({ id: ref.id, ...catalogItem });
}));

// PATCH /api/catalog/:id/promo
router.patch('/:id/promo', requireAdmin, asyncHandler(async (req, res) => {
  const { isPromo } = req.body;
  const ref = db.collection(CATALOG).doc(req.params.id);
  const doc = await ref.get();
  
  if (!doc.exists) return res.status(404).json({ error: 'Producto del catálogo no encontrado.' });
  
  await ref.update({ isPromo: Boolean(isPromo), updatedAt: FieldValue.serverTimestamp() });
  
  res.json({ id: req.params.id, isPromo: Boolean(isPromo) });
}));

// POST /api/catalog/upload
router.post('/upload', requireAdmin, upload.array('images', 5), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se enviaron imágenes.' });
  }

  const uploadedUrls = [];
  
  for (const file of req.files) {
    const ext = (file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    const filename = `${Date.now()}-${Math.floor(Math.random()*1000)}${ext}`;
    const url = await storage.uploadFile(file.buffer, 'catalog-images', filename, file.mimetype);
    uploadedUrls.push(url);
  }

  res.status(201).json({ urls: uploadedUrls });
}));

// PATCH /api/catalog/reorder
router.patch('/reorder', requireAdmin, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Formato de items inválido.' });
  }

  const batch = db.batch();
  for (const item of items) {
    if (item.id && typeof item.order === 'number') {
      const ref = db.collection(CATALOG).doc(item.id);
      batch.update(ref, { 
        order: item.order, 
        updatedAt: FieldValue.serverTimestamp() 
      });
    }
  }

  await batch.commit();
  res.status(200).json({ success: true, message: 'Orden actualizado exitosamente.' });
}));

module.exports = router;
