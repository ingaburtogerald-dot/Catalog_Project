const { db } = require('./firebase');
const config = require('./config');

const PURGE_DAYS = 15;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function purgeDeletedProducts() {
  try {
    console.log('[CRON] Iniciando purga de papelera de Inventario Físico...');
    const now = Date.now();
    const thresholdDateMs = now - (PURGE_DAYS * MS_PER_DAY);
    const thresholdDate = new Date(thresholdDateMs);
    
    // Obtenemos todos los productos (se podría optimizar con una query if deletedAt is indexed)
    const snap = await db.collection(config.collections.products).get();
    
    const itemsToDelete = [];
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.deletedAt) {
        // deletedAt is a Firestore Timestamp
        const deletedTime = data.deletedAt.toDate ? data.deletedAt.toDate() : new Date(data.deletedAt);
        if (deletedTime < thresholdDate) {
          itemsToDelete.push(doc.id);
        }
      }
    });

    if (itemsToDelete.length === 0) {
      console.log('[CRON] No hay ítems en papelera mayores a 15 días para purgar.');
      return;
    }

    console.log(`[CRON] Se purgarán definitivamente ${itemsToDelete.length} ítems de la papelera.`);

    // Borrado en cascada: remover de los catálogos vinculados
    const catalogSnap = await db.collection(config.collections.catalog).get();
    const batch = db.batch();
    
    catalogSnap.docs.forEach(catDoc => {
      const data = catDoc.data();
      if (data.variants && Array.isArray(data.variants)) {
        let modified = false;
        const updatedVariants = data.variants.filter(v => {
          if (itemsToDelete.includes(v)) {
            modified = true;
            return false;
          }
          return true;
        });
        
        if (modified) {
          batch.update(catDoc.ref, { variants: updatedVariants });
        }
      }
    });

    // Eliminar los productos físicamente
    itemsToDelete.forEach(id => {
      const ref = db.collection(config.collections.products).doc(id);
      batch.delete(ref);
    });

    await batch.commit();
    console.log('[CRON] Purga en cascada completada exitosamente.');
  } catch (error) {
    console.error('[CRON] Error durante la purga de papelera:', error);
  }
}

// Configurar el temporizador (ejecutar 1 vez al día)
function startCronJobs() {
  console.log('[CRON] Jobs inicializados. Purga de Papelera configurada cada 24 horas.');
  // Ejecutar inmediatamente al inicio
  purgeDeletedProducts();
  // Luego cada 24 horas
  setInterval(purgeDeletedProducts, MS_PER_DAY);
}

module.exports = { startCronJobs, purgeDeletedProducts };
