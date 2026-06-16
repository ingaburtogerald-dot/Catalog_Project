const { db } = require('../firebase');
const { getAuth } = require('firebase-admin/auth');
const config = require('../config');

const VALID_ROLES = config.validRoles;

function primaryRole(roles) {
  return config.rolePriority.find((r) => roles.includes(r)) || roles[0] || null;
}

// Busca los roles del usuario: env vars primero (rápido y sin índice), luego Firestore.
// Devuelve siempre un array (vacío si no tiene ningún rol válido).
async function resolveRoles(email) {
  const lower = email.toLowerCase();

  // 1. Variables de entorno — siempre disponibles, sin depender de Firestore
  if (config.adminEmails.includes(lower)) return ['admin'];
  if (config.sellerEmails.includes(lower)) return ['seller'];

  // 2. Firestore — para usuarios creados desde el panel de gestión
  //    Query de un solo campo para evitar requerir índice compuesto.
  try {
    const snap = await db.collection(config.collections.users)
      .where('email', '==', lower)
      .limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      if (data.status === 'active') {
        const roles = Array.isArray(data.roles) && data.roles.length
          ? data.roles.filter((r) => VALID_ROLES.includes(r))
          : (VALID_ROLES.includes(data.role) ? [data.role] : []);
        if (roles.length) return roles;
      }
    }
  } catch (err) {
    console.error('⚠️  resolveRoles Firestore error:', err.message);
  }

  return [];
}

// Mantener compatibilidad con código que aún espera un solo rol string.
async function resolveRole(email) {
  const roles = await resolveRoles(email);
  return primaryRole(roles);
}

async function authenticate(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { error: 401, message: 'Falta el token de sesión.' };

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && token === 'dev-token') {
    return { user: { uid: 'dev-uid', email: 'dev-admin@gyrostore.com', name: 'Dev Admin', roles: ['admin'], role: 'admin' } };
  }
  if (isDev && token === 'dev-seller-token') {
    return { user: { uid: 'dev-seller-uid', email: 'dev-seller@gyrostore.com', name: 'Dev Seller', roles: ['seller'], role: 'seller' } };
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email) return { error: 403, message: 'Token sin correo electrónico.' };

    // Usuarios externos (Google) deben tener email verificado.
    // Usuarios internos (@gyrostore.com) se consideran verificados por el dominio.
    const isInternal = decoded.email.toLowerCase().endsWith(`@${config.internalDomain}`);
    if (!isInternal && !decoded.email_verified)
      return { error: 403, message: 'El correo de la cuenta no está verificado.' };

    const roles = await resolveRoles(decoded.email);
    return {
      user: { uid: decoded.uid, email: decoded.email, name: decoded.name || '', roles, role: primaryRole(roles) },
    };
  } catch (err) {
    console.error('❌ Token verification error:', err.message);
    return { error: 401, message: 'Sesión inválida o expirada.' };
  }
}

// Middleware factory: permite el paso si el usuario tiene alguno de los roles indicados,
// o si tiene el rol 'global_admin' (acceso total a todos los portales).
function requireRole(...allowed) {
  return async function (req, res, next) {
    const result = await authenticate(req);
    if (result.error) return res.status(result.error).json({ error: result.message });

    const { roles } = result.user;
    const ok = roles.includes('global_admin') || allowed.some((r) => roles.includes(r));
    if (!ok) return res.status(403).json({ error: 'Esta cuenta no tiene permisos para esta sección.' });

    req.user = result.user;
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireSeller = requireRole('admin', 'seller', 'cashier');
const requireLogisticsAdmin = requireRole('admin', 'logistics_admin');
const requireLogisticsAny = requireRole('admin', 'logistics_admin', 'logistics_customer');
// Cualquier rol válido del sistema — usado por /auth/me, donde solo nos interesa saber quién es.
const requireAnyRole = requireRole(...VALID_ROLES);

module.exports = {
  requireAdmin,
  requireSeller,
  requireLogisticsAdmin,
  requireLogisticsAny,
  requireAnyRole,
  requireRole,
  resolveRole,
  resolveRoles,
};
