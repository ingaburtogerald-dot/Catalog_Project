// Siembra Firestore con los productos iniciales (lee productos.json desde la raíz).
// Uso:  npm run seed
const fs = require('fs');
const path = require('path');
const { db, FieldValue } = require('../server/firebase');
const config = require('../server/config');

async function seed() {
  // En nuestro proyecto, productos.json está en la raíz, no en public/
  const file = path.join(__dirname, '..', 'productos.json');
  const products = JSON.parse(fs.readFileSync(file, 'utf8'));

  console.log(`\n🌱 Sembrando ${products.length} productos en la colección "${config.collections.products}"...\n`);

  const batch = db.batch();
  for (const p of products) {
    const { id, ...data } = p;
    // Usa el slug/id como ID del documento para URLs y referencias estables.
    const ref = db.collection(config.collections.products).doc(id);
    batch.set(ref, { ...data, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    console.log(`  ✓ ${id} — ${data.name}`);
  }
  await batch.commit();

  console.log(`\n✅ Listo. ${products.length} productos cargados en Firestore.\n`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌ Error al sembrar:', err.message, '\n');
  process.exit(1);
});
