const { db, FieldValue } = require('../server/firebase');
const config = require('../server/config');

const COL_PURCHASES = config.collections.purchases;
const COL_PRODUCTS = config.collections.products;

const purchases = [
  { code: 'IN1', product: 'EDX Pro | Mic | Azul turquesa', qty: 5, cost: 4.61, tax: 0.2068 },
  { code: 'IN2', product: 'EDX Pro | Mic | Negro', qty: 15, cost: 4.61, tax: 0.2068 },
  { code: 'IN3', product: 'KZ AZ09 Pin C', qty: 15, cost: 13.50, tax: 0.2068 },
  { code: 'IN4', product: 'KZ Castor Harman | Mic', qty: 10, cost: 7.78, tax: 0.2068 },
  { code: 'IN5', product: 'EDX Ultra | Mic | Black', qty: 10, cost: 6.35, tax: 0.2068 },
  { code: 'IN6', product: 'EDX Ultra | Mic | Black', qty: 10, cost: 6.35, tax: 0.2068 },
  { code: 'IN7', product: 'KZ Castor | Mic | Bass', qty: 20, cost: 9.37, tax: 0.2068 },
  { code: 'IN8', product: 'KZ AZ09 Pin C', qty: 15, cost: 13.50, tax: 0.2068 },
  { code: 'IN9', product: 'KZ Castor | Mic | Bass', qty: 20, cost: 9.37, tax: 0.2068 },
  { code: 'IN10', product: 'EDX Pro | Mic | Transparente', qty: 20, cost: 4.53, tax: 0.2068 },
  { code: 'IN11', product: 'KZ Castor Pro Bass | Mic', qty: 40, cost: 11.12, tax: 0.2068 },
  { code: 'IN12', product: 'KZ Castor Pro Harman | Mic', qty: 10, cost: 9.53, tax: 0.2068 },
  { code: 'IN13', product: 'EDX Pro | Mic | Transparente', qty: 5, cost: 4.61, tax: 0.2068 },
  { code: 'IN14', product: 'EDX Pro X | Mic | Negro', qty: 120, cost: 4.53, tax: 0.2068 },
  { code: 'IN15', product: 'EDX Pro X | Mic | Transparente', qty: 20, cost: 4.53, tax: 0.2068 },
  { code: 'IN16', product: 'EDX Pro X | Mic | Gris', qty: 20, cost: 4.53, tax: 0.2068 }
];

async function seed() {
  console.log('🌱 Iniciando siembra de compras Lote LT1...');

  // Obtener nombres de productos existentes
  const prodSnap = await db.collection(COL_PRODUCTS).get();
  const existingNames = new Set(prodSnap.docs.map(d => String(d.data().name || '').toLowerCase().trim()));

  const rate = 37.00;
  const date = '2026-04-28';
  const lote = 'LT1';
  const status = 'Recibido';

  for (const item of purchases) {
    const unitCost = item.cost + item.tax;
    const totalUsd = item.qty * unitCost;
    const totalNio = totalUsd * rate;

    const purchaseDoc = {
      lote,
      code: item.code,
      date,
      product: item.product,
      qty: item.qty,
      cost: item.cost,
      tax: item.tax,
      unitCost,
      totalUsd,
      totalNio,
      exchangeRate: rate,
      status,
      createdAt: FieldValue.serverTimestamp()
    };

    // Agregar compra a Firestore
    const purRef = await db.collection(COL_PURCHASES).add(purchaseDoc);
    console.log(`✅ Compra registrada: ${item.code} - ${item.product} (ID: ${purRef.id})`);

    // Alimentar catálogo dinámicamente
    const normName = item.product.toLowerCase().trim();
    if (!existingNames.has(normName)) {
      const suggestedPriceNio = Math.ceil(unitCost * rate * 1.40);
      const newProductDoc = {
        name: item.product,
        category: 'in-ear',
        price: suggestedPriceNio,
        img: '',
        desc: `Importado en Lote ${lote}. Costo unitario: $${unitCost.toFixed( unitCost > 10 ? 2 : 4)} USD.`,
        variants: [],
        specs: [],
        createdAt: FieldValue.serverTimestamp()
      };
      const prodRef = await db.collection(COL_PRODUCTS).add(newProductDoc);
      existingNames.add(normName);
      console.log(`   ✨ Ficha de producto creada en el catálogo: ${item.product} (ID: ${prodRef.id})`);
    }
  }

  console.log('\n🎉 Siembra completada con éxito!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error sembrando compras:', err);
  process.exit(1);
});
