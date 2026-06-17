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

// Obtiene el nombre base del producto (todo lo que esté antes del primer '|' o el nombre completo)
function getBaseName(name) {
  if (!name) return '';
  return name.split('|')[0].trim();
}

// Reconciliación automática de variantes físicas con los ítems del catálogo comercial
async function reconcileVariants() {
  try {
    const catalogSnap = await db.collection(CATALOG).get();
    const catalogItems = catalogSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const prodSnap = await db.collection(PRODUCTS).get();
    const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.deletedAt == null);

    const linkedIds = new Set();
    catalogItems.forEach(item => {
      if (Array.isArray(item.variants)) {
        item.variants.forEach(id => linkedIds.add(id));
      }
    });

    const unlinkedProducts = products.filter(p => !linkedIds.has(p.id));
    if (unlinkedProducts.length === 0) return;

    const batch = db.batch();
    let hasUpdates = false;

    for (const product of unlinkedProducts) {
      const prodBase = getBaseName(product.name).toLowerCase().trim();
      if (!prodBase) continue;

      // Buscar si algún catálogo existente coincide en su Nombre Base (comparación sin distinción de mayúsculas/minúsculas)
      const matchingCatalog = catalogItems.find(item => {
        const catBase = getBaseName(item.name).toLowerCase().trim();
        return catBase === prodBase;
      });

      if (matchingCatalog) {
        const catalogRef = db.collection(CATALOG).doc(matchingCatalog.id);
        const currentVariants = matchingCatalog.variants || [];
        if (!currentVariants.includes(product.id)) {
          currentVariants.push(product.id);
          batch.update(catalogRef, {
            variants: currentVariants,
            updatedAt: FieldValue.serverTimestamp()
          });
          // Actualizar en memoria también por si acaso
          matchingCatalog.variants = currentVariants;
          hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      await batch.commit();
      console.log('✅ Reconciliación exitosa: Variantes físicas auto-enlazadas al catálogo.');
    }
  } catch (err) {
    console.error('❌ Error en la reconciliación de variantes:', err.message);
  }
}

// Limpia productos del inventario físico (products) que ya no están referenciados por ninguna compra
async function cleanStaleInventoryProducts() {
  try {
    const PURCHASES = config.collections.purchases;

    // 1. Obtener todas las compras
    const purchasesSnap = await db.collection(PURCHASES).get();
    const referencedProductNames = new Set();
    purchasesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.product) {
        referencedProductNames.add(String(data.product).trim().toLowerCase());
      }
    });

    // 2. Obtener todos los productos físicos de la colección products
    const prodSnap = await db.collection(PRODUCTS).get();
    const allProducts = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const toDelete = [];
    allProducts.forEach(p => {
      const nameLower = String(p.name || '').trim().toLowerCase();
      // Si el nombre del producto físico no está referenciado por ninguna compra, está huérfano
      if (!referencedProductNames.has(nameLower)) {
        toDelete.push(p);
      }
    });

    if (toDelete.length === 0) return;

    console.log(`🧹 Encontrados ${toDelete.length} productos físicos huérfanos. Procediendo a borrar...`);
    const batch = db.batch();
    toDelete.forEach(p => {
      const ref = db.collection(PRODUCTS).doc(p.id);
      batch.delete(ref);
    });

    // 3. Limpiar las referencias obsoletas de variants en los catálogos
    const catalogSnap = await db.collection(CATALOG).get();
    catalogSnap.docs.forEach(doc => {
      const data = doc.data();
      if (Array.isArray(data.variants)) {
        const updatedVariants = data.variants.filter(vid => {
          return !toDelete.some(p => p.id === vid);
        });
        if (updatedVariants.length !== data.variants.length) {
          batch.update(doc.ref, { 
            variants: updatedVariants,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }
    });

    await batch.commit();
    console.log(`🧹 Limpieza automática completada: ${toDelete.length} productos huérfanos borrados.`);
  } catch (err) {
    console.error('❌ Error en la limpieza automática de productos huérfanos:', err.message);
  }
}

// Ciclo unificado de sincronización y limpieza del estado de la base de datos
async function syncDatabaseState() {
  await cleanStaleInventoryProducts();
  await reconcileVariants();
}

// Exponer en el router para uso de otros módulos (redireccionado al ciclo completo de limpieza + reconciliación)
router.reconcileVariants = syncDatabaseState;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// GET /api/catalog
router.get('/', asyncHandler(async (req, res) => {
  const { all, isPromo, category } = req.query;

  // 1. Obtener ítems del catálogo
  let query = db.collection(CATALOG);
  if (isPromo === 'true') {
    query = query.where('isPromo', '==', true);
  }
  if (category && category !== 'all') {
    query = query.where('category', '==', category);
  }
  const snap = await query.get();
  const catalogItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 2. Obtener productos del inventario físico (no eliminados)
  const prodSnap = await db.collection(PRODUCTS).get();
  const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.deletedAt == null);
  const productsMap = {};
  products.forEach(p => {
    productsMap[p.id] = p;
  });

  // 3. Calcular stock de productos desde compras en estado Recibido
  const purSnap = await db.collection(config.collections.purchases).where('status', '==', 'Recibido').get();
  const stocksByProduct = {};
  purSnap.docs.forEach(doc => {
    const p = doc.data();
    if (p.product && p.qty) {
      const available = Math.max(0, p.qty - (p.qtySold || 0));
      stocksByProduct[p.product] = (stocksByProduct[p.product] || 0) + available;
    }
  });

  // 4. Calcular precio comercial (máximo de variantes) y stock total
  const enrichedCatalogItems = catalogItems.map(item => {
    let totalStock = 0;
    let maxPrice = 0;
    const itemVariants = item.variants || [];

    itemVariants.forEach(variantId => {
      const p = productsMap[variantId];
      if (p) {
        const pStock = stocksByProduct[p.name] || stocksByProduct[p.id] || 0;
        totalStock += pStock;
        const pPrice = p.price || 0;
        if (pPrice > maxPrice) {
          maxPrice = pPrice;
        }
      }
    });

    return {
      ...item,
      stock: totalStock,
      price: maxPrice || item.price || 0
    };
  });

  // 5. Ordenar por orden
  enrichedCatalogItems.sort((a, b) => (a.order || 0) - (b.order || 0));

  // 6. Filtrar para la vista pública (salvo si es admin y solicita todo: all === 'true')
  if (all !== 'true') {
    const publicItems = enrichedCatalogItems.filter(item => (item.variants || []).length > 0 && item.stock > 0);
    return res.json(publicItems);
  }

  res.json(enrichedCatalogItems);
}));

// GET /api/catalog/top-sellers
router.get('/top-sellers', asyncHandler(async (req, res) => {
  const ordersSnap = await db.collection(ORDERS)
    .where('status', 'in', ['approved', 'delivered'])
    .get();
    
  const salesByVariantId = {};
  
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

  const catalogSnap = await db.collection(CATALOG).get();
  const catalogItems = catalogSnap.docs.map(d => ({ id: d.id, ...d.data(), totalSold: 0 }));

  for (const [variantId, qty] of Object.entries(salesByVariantId)) {
    const parentCatalog = catalogItems.find(c => c.variants && c.variants.includes(variantId));
    if (parentCatalog) {
      parentCatalog.totalSold += qty;
    }
  }

  const topSellers = catalogItems
    .filter(c => c.totalSold > 0)
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 10);

  res.json(topSellers);
}));

// GET /api/catalog/unconfigured
router.get('/unconfigured', requireAdmin, asyncHandler(async (req, res) => {
  // 0. Ejecutar reconciliación de variantes primero
  await reconcileVariants();

  // 1. Obtener IDs de variantes físicas enlazadas actualizados
  const catalogSnap = await db.collection(CATALOG).get();
  const linkedIds = new Set();
  catalogSnap.docs.forEach(doc => {
    const data = doc.data();
    if (Array.isArray(data.variants)) {
      data.variants.forEach(id => linkedIds.add(id));
    }
  });

  // 2. Obtener productos de inventario no eliminados
  const prodSnap = await db.collection(PRODUCTS).get();
  const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.deletedAt == null);

  // 3. Filtrar aquellos no configurados
  const unconfiguredProducts = products.filter(p => !linkedIds.has(p.id));

  // 4. Agrupar por Nombre Base
  const groupsMap = {};
  unconfiguredProducts.forEach(p => {
    const baseName = getBaseName(p.name);
    const key = baseName.toLowerCase().trim();
    if (!groupsMap[key]) {
      groupsMap[key] = {
        id: p.id,
        name: baseName,
        category: p.category || 'in-ear',
        price: p.price || 0,
        desc: p.desc || '',
        variants: []
      };
    }
    groupsMap[key].variants.push(p.id);
    if ((p.price || 0) > groupsMap[key].price) {
      groupsMap[key].price = p.price;
    }
  });

  const unconfiguredGroups = Object.values(groupsMap);
  res.json(unconfiguredGroups);
}));

// GET /api/catalog/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const ref = db.collection(CATALOG).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'Producto del catálogo no encontrado.' });
  }

  const catalogItem = { id: doc.id, ...doc.data() };
  const variantIds = catalogItem.variants || [];
  const variantsEnriched = [];

  for (const variantId of variantIds) {
    const pDoc = await db.collection(PRODUCTS).doc(variantId).get();
    if (pDoc.exists && pDoc.data().deletedAt == null) {
      const pData = pDoc.data();
      variantsEnriched.push({
        id: pDoc.id,
        name: pData.name,
        price: pData.price || 0
      });
    }
  }

  res.json({
    ...catalogItem,
    variants: variantsEnriched
  });
}));

// POST /api/catalog
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, category, desc, variants, isPromo, images } = req.body;
  
  if (!name || !category) {
    return res.status(400).json({ error: 'Nombre y categoría son requeridos.' });
  }

  let maxPrice = 0;
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

// PUT /api/catalog/:id
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { name, category, desc, variants, isPromo, images } = req.body;
  const ref = db.collection(CATALOG).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'Producto del catálogo no encontrado.' });
  }

  let maxPrice = 0;
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

  const updatedItem = {
    name: String(name).trim(),
    category: String(category).trim(),
    desc: String(desc || '').trim(),
    variants: Array.isArray(variants) ? variants : [],
    images: Array.isArray(images) ? images : [],
    isPromo: Boolean(isPromo),
    price: maxPrice,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.update(updatedItem);
  res.json({ id: req.params.id, ...updatedItem });
}));

// DELETE /api/catalog/:id
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(CATALOG).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'Producto del catálogo no encontrado.' });
  }
  await ref.delete();
  res.json({ success: true, id: req.params.id });
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
