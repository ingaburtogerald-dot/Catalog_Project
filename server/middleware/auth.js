const { db } = require('../firebase');
const { getAuth } = require('firebase-admin/auth');
const config = require('../config');

const VALID_ROLES = ['admin', 'seller', 'cashier'];

// Busca el rol del usuario: env vars primero (rápido y sin índice), luego Firestore.
async function resolveRole(email) {
  const lower = email.toLowerCase();

  // 1. Variables de entorno — siempre disponibles, sin depender de Firestore
  if (config.adminEmails.includes(lower))  return 'admin';
  if (config.sellerEmails.includes(lower)) return 'seller';

  // 2. Firestore — para usuarios creados desde el panel de gestión
  //    Query de un solo campo para evitar requerir índice compuesto.
  try {
    const snap = await db.collection(config.collections.users)
      .where('email', '==', lower)
      .limit(1).get();
    if (!snap.empty) {
      const { role, status } = snap.docs[0].data();
      if (status === 'active' && VALID_ROLES.includes(role)) return role;
    }
  } catch (err) {
    console.error('⚠️  resolveRole Firestore error:', err.message);
  }

  return null;
}

async function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Falta el token de sesión.' });

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && token === 'dev-token') {
    req.user = { uid: 'dev-uid', email: 'dev-admin@gyrostore.com', name: 'Dev Admin', role: 'admin' };
    return next();
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email) return res.status(403).json({ error: 'Token sin correo electrónico.' });

    // Usuarios externos (Google) deben tener email verificado.
    // Usuarios internos (@gyrostore.com) se consideran verificados por el dominio.
    const isInternal = decoded.email.toLowerCase().endsWith(`@${config.internalDomain}`);
    if (!isInternal && !decoded.email_verified)
      return res.status(403).json({ error: 'El correo de la cuenta no está verificado.' });

    const role = await resolveRole(decoded.email);
    if (role !== 'admin')
      return res.status(403).json({ error: 'Esta cuenta no tiene permisos de administrador.' });

    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name || '', role };
    next();
  } catch (err) {
    console.error('❌ Token verification error:', err.message);
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

async function requireSeller(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Falta el token de sesión.' });

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && token === 'dev-token') {
    req.user = { uid: 'dev-uid', email: 'dev-admin@gyrostore.com', name: 'Dev Admin', role: 'admin' };
    return next();
  }
  if (isDev && token === 'dev-seller-token') {
    req.user = { uid: 'dev-seller-uid', email: 'dev-seller@gyrostore.com', name: 'Dev Seller', role: 'seller' };
    return next();
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email) return res.status(403).json({ error: 'Token sin correo electrónico.' });

    const isInternal = decoded.email.toLowerCase().endsWith(`@${config.internalDomain}`);
    if (!isInternal && !decoded.email_verified)
      return res.status(403).json({ error: 'El correo de la cuenta no está verificado.' });

    const role = await resolveRole(decoded.email);
    if (!role)
      return res.status(403).json({ error: 'Esta cuenta no tiene permisos autorizados.' });

    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name || '', role };
    next();
  } catch (err) {
    console.error('❌ Token verification error:', err.message);
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

module.exports = { requireAdmin, requireSeller, resolveRole };
