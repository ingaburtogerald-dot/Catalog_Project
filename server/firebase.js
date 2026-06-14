// Inicialización de Firebase Admin SDK (solo servidor).
// Lee las credenciales (service account) desde el archivo indicado en SERVICE_ACCOUNT_PATH.
const admin = require('firebase-admin');
const { getApps } = require('firebase-admin/app');
const fs = require('fs');
const path = require('path');
const config = require('./config');

function init() {
  if (getApps().length) return admin;

  const keyPath = path.resolve(process.cwd(), config.serviceAccountPath);

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.cert(serviceAccount) });
      console.log(`🔑 Firebase Admin inicializado desde variable de entorno: ${serviceAccount.project_id}`);
    } catch (e) {
      console.error('❌ Error al parsear FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
      process.exit(1);
    }
  } else if (fs.existsSync(keyPath)) {
    const serviceAccount = require(keyPath);
    admin.initializeApp({ credential: admin.cert(serviceAccount) });
    console.log(`🔑 Firebase Admin inicializado para el proyecto: ${serviceAccount.project_id}`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Alternativa: credenciales por defecto del entorno (ADC)
    admin.initializeApp();
    console.log('🔑 Firebase Admin inicializado con GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    console.error('\n❌ No se encontró el archivo de credenciales de Firebase.');
    console.error(`   Buscado en: ${keyPath}\n`);
    console.error('   Cómo obtenerlo:');
    console.error('   1. Firebase Console → ⚙️ Configuración del proyecto → Cuentas de servicio');
    console.error('   2. "Generar nueva clave privada" → descarga el JSON');
    console.error('   3. Guárdalo como  server/serviceAccountKey.json');
    console.error('      (o ajusta SERVICE_ACCOUNT_PATH en el archivo .env)\n');
    process.exit(1);
  }

  return admin;
}

const app = init();
const db = app.firestore();
const { FieldValue, Timestamp } = admin.firestore;

module.exports = { admin: app, db, FieldValue, Timestamp };
