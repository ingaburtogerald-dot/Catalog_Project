// Configuración central del backend (lee variables de entorno desde .env)
require('dotenv').config();

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const sellerEmails = (process.env.SELLER_EMAILS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

module.exports = {
  port: Number(process.env.PORT) || 3000,
  serviceAccountPath: process.env.SERVICE_ACCOUNT_PATH || './server/serviceAccountKey.json',
  oneDriveSharingUrl: process.env.ONEDRIVE_SHARING_URL || '',

  // Lista blanca de roles (compatibilidad con sistema anterior)
  adminEmails,
  sellerEmails,

  // Primer admin en la lista — no puede ser eliminado por nadie
  protectedEmail: (process.env.PROTECTED_ADMIN_EMAIL || adminEmails[0] || '').toLowerCase(),

// Config pública de la Web App de Firebase (para el login con Google en el admin)
  firebaseWeb: (() => {
    let web = {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || '',
    };
    if (process.env.FIREBASE_WEB_CONFIG) {
      try {
        web = { ...web, ...JSON.parse(process.env.FIREBASE_WEB_CONFIG) };
      } catch (err) {
        console.error('⚠️ Error al parsear FIREBASE_WEB_CONFIG:', err.message);
      }
    }
    return web;
  })(),

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

  collections: { products: 'products', orders: 'orders', purchases: 'purchases', users: 'users', usersDeleted: 'users_deleted' },

  // Dominio interno para usuarios locales
  internalDomain: process.env.INTERNAL_DOMAIN || 'gyrostore.com',

  // Configuración SMTP para correos de invitación (opcional)
  email: (() => {
    let mail = {
      host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
      port:   Number(process.env.EMAIL_PORT) || 465,
      secure: process.env.EMAIL_SECURE !== 'false',
      user:   process.env.EMAIL_USER   || '',
      pass:   process.env.EMAIL_PASS   || '',
      from:   process.env.EMAIL_FROM   || '',
    };
    if (process.env.EMAIL_CONFIG) {
      try {
        mail = { ...mail, ...JSON.parse(process.env.EMAIL_CONFIG) };
      } catch (err) {
        console.error('⚠️ Error al parsear EMAIL_CONFIG:', err.message);
      }
    }
    return mail;
  })(),
};

