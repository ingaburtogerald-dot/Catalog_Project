// Configuración central del backend (lee variables de entorno desde .env)
require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3000,
  serviceAccountPath: process.env.SERVICE_ACCOUNT_PATH || './server/serviceAccountKey.json',
  oneDriveSharingUrl: process.env.ONEDRIVE_SHARING_URL || '',

  // Lista blanca de administradores (correos de Google autorizados)
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // Lista blanca de vendedores (correos de Google/Firebase autorizados)
  sellerEmails: (process.env.SELLER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // Config pública de la Web App de Firebase (para el login con Google en el admin)
  firebaseWeb: {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
  },

  // Datos de negocio (se exponen al frontend vía GET /api/config)
  whatsapp: process.env.WHATSAPP_NUMBER || '50585944758',
  currency: process.env.CURRENCY || 'C$',
  volume: {
    minQty: Number(process.env.VOLUME_MIN_QTY) || 3,
    percent: Number(process.env.VOLUME_PERCENT) || 10,
  },

  // Categorías del catálogo (con su ícono para la UI)
  categories: [
    { id: 'in-ear',       name: 'In-Ear',           icon: '🎧' },
    { id: 'computadoras', name: 'Accesorios PC',    icon: '🖱️' },
    { id: 'diadema',      name: 'Diadema',          icon: '🎚️' },
    { id: 'audio',        name: 'Accesorios Audio', icon: '🔊' },
    { id: 'bluetooth',    name: 'Bluetooth',        icon: '📶' },
  ],

  collections: { products: 'products', orders: 'orders', purchases: 'purchases' },
};
