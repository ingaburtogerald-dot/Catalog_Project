const { admin } = require('../firebase');
const { getAuth } = require('firebase-admin/auth');
const config = require('../config');

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de sesión.' });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && token === 'dev-token') {
    req.user = { uid: 'dev-uid', email: 'dev-admin@gyrostore.com', name: 'Dev Admin' };
    return next();
  }

  if (config.adminEmails.length === 0) {
    return res.status(500).json({ error: 'No hay administradores configurados (ADMIN_EMAILS).' });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);

    if (!decoded.email || !decoded.email_verified) {
      return res.status(403).json({ error: 'El correo de la cuenta no está verificado.' });
    }
    if (!config.adminEmails.includes(decoded.email.toLowerCase())) {
      return res.status(403).json({ error: 'Esta cuenta no tiene permisos de administrador.' });
    }

    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name || '' };
    next();
  } catch (err) {
    console.error('❌ Error verifying Firebase ID token:', err);
    return res.status(401).json({ error: 'Sesión inválida o expirada. Iniciá sesión de nuevo.' });
  }
}

async function requireSeller(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de sesión.' });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && token === 'dev-token') {
    req.user = { uid: 'dev-uid', email: 'dev-admin@gyrostore.com', name: 'Dev Admin' };
    return next();
  }
  if (isDev && token === 'dev-seller-token') {
    req.user = { uid: 'dev-seller-uid', email: 'dev-seller@gyrostore.com', name: 'Dev Seller' };
    return next();
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);

    if (!decoded.email || !decoded.email_verified) {
      return res.status(403).json({ error: 'El correo de la cuenta no está verificado.' });
    }

    const email = decoded.email.toLowerCase();
    const isAdmin = config.adminEmails.includes(email);
    const isSeller = config.sellerEmails.includes(email);

    if (!isAdmin && !isSeller) {
      return res.status(403).json({ error: 'Esta cuenta no tiene permisos autorizados.' });
    }

    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name || '' };
    next();
  } catch (err) {
    console.error('❌ Error verifying Firebase ID token:', err);
    return res.status(401).json({ error: 'Sesión inválida o expirada. Iniciá sesión de nuevo.' });
  }
}

module.exports = {
  requireAdmin,
  requireSeller
};
