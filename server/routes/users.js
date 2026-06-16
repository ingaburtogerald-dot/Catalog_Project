// Gestión de usuarios: CRUD + papelera (30 días). Solo admins.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const { getAuth } = require('firebase-admin/auth');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');
const { sendLocalInvite, sendGuestInvite } = require('../email');
const config = require('../config');

const USERS = config.collections.users;
const TRASH = config.collections.usersDeleted;
const VALID_ROLES = ['admin', 'seller', 'cashier'];

function generatePassword(len = 14) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const snap = await db.collection(TRASH).where('deletedAt', '<', cutoff).get();
  for (const doc of snap.docs) {
    const uid = doc.data().uid;
    if (uid) { try { await getAuth().deleteUser(uid); } catch {} }
    await doc.ref.delete();
  }
}

// ── Trash routes FIRST so Express doesn't swallow "trash" as :id ──────────

// GET /api/users/trash
router.get('/trash', requireAdmin, asyncHandler(async (req, res) => {
  await purgeExpiredTrash();
  const snap = await db.collection(TRASH).orderBy('deletedAt', 'desc').get();
  const now = Date.now();
  res.json(snap.docs.map(d => {
    const data = d.data();
    const expiresAt = data.expiresAt?.toDate?.() ?? new Date(data.expiresAt);
    const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / 86400000));
    return { id: d.id, ...data, daysLeft };
  }));
}));

// POST /api/users/trash/:id/restore
router.post('/trash/:id/restore', requireAdmin, asyncHandler(async (req, res) => {
  const trashRef = db.collection(TRASH).doc(req.params.id);
  const snap = await trashRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'No encontrado en la papelera.' });

  const { deletedAt, deletedBy, expiresAt, ...userData } = snap.data();

  if (userData.uid && userData.type === 'local') {
    try { await getAuth().updateUser(userData.uid, { disabled: false }); } catch {}
  }

  const ref = await db.collection(USERS).add({
    ...userData,
    status: 'active',
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy: req.user.email,
  });
  await trashRef.delete();
  res.json({ id: ref.id, ...userData });
}));

// DELETE /api/users/trash/:id — permanent
router.delete('/trash/:id', requireAdmin, asyncHandler(async (req, res) => {
  const trashRef = db.collection(TRASH).doc(req.params.id);
  const snap = await trashRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'No encontrado en la papelera.' });

  const uid = snap.data().uid;
  if (uid) { try { await getAuth().deleteUser(uid); } catch {} }
  await trashRef.delete();
  res.json({ ok: true });
}));

// ── Main user routes ───────────────────────────────────────────────────────

// GET /api/users — combina Firestore (gestionados) + Firebase Auth (legados sin doc Firestore)
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  // 1. Usuarios ya gestionados en Firestore
  const snap = await db.collection(USERS).orderBy('createdAt', 'desc').get();
  const firestoreUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const firestoreUids   = new Set(firestoreUsers.map(u => u.uid).filter(Boolean));
  const firestoreEmails = new Set(firestoreUsers.map(u => u.email.toLowerCase()));

  // 2. Buscar en Firebase Auth usuarios que aún no tienen documento Firestore
  const legacyUsers = [];
  let pageToken;
  do {
    const result = await getAuth().listUsers(1000, pageToken);
    for (const u of result.users) {
      const email = (u.email || '').toLowerCase();
      if (!email) continue;
      if (firestoreUids.has(u.uid) || firestoreEmails.has(email)) continue; // ya en Firestore

      const isInternal = email.endsWith(`@${config.internalDomain}`);
      const role = config.adminEmails.includes(email) ? 'admin'
                 : config.sellerEmails.includes(email) ? 'seller'
                 : null;

      // Mostrar: usuarios del dominio interno (@gyrostore.com) siempre,
      // y usuarios externos solo si tienen rol en env vars.
      if (!role && !isInternal) continue;

      legacyUsers.push({
        id: `legacy:${email}`,
        uid: u.uid,
        email,
        displayName: u.displayName || email.split('@')[0],
        role: role || 'sin-rol',
        type: isInternal ? 'local' : 'guest',
        status: 'active',
        legacy: true,
        protected: email === config.protectedEmail,
        createdAt: null,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  // Marcar protectedEmail también en usuarios de Firestore
  const withProtected = firestoreUsers.map(u => ({
    ...u,
    protected: u.email.toLowerCase() === config.protectedEmail,
  }));

  res.json([...withProtected, ...legacyUsers]);
}));

// POST /api/users — crear usuario local o invitado
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { type, displayName, username, email, role, sendInvite } = req.body || {};

  if (!['local', 'guest'].includes(type))
    return res.status(400).json({ error: 'Tipo inválido. Use "local" o "guest".' });
  if (!displayName?.trim())
    return res.status(400).json({ error: 'El nombre para mostrar es obligatorio.' });
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: `Rol inválido. Use: ${VALID_ROLES.join(', ')}.` });

  // ── Usuario local @gyrostore.com ──
  if (type === 'local') {
    if (!username?.trim())
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio.' });

    const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!clean) return res.status(400).json({ error: 'El nombre de usuario contiene caracteres inválidos.' });
    const fullEmail = `${clean}@${config.internalDomain}`;

    const existing = await db.collection(USERS).where('email', '==', fullEmail).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });

    const tempPassword = generatePassword();
    let uid;
    try {
      const fbUser = await getAuth().createUser({
        email: fullEmail, password: tempPassword,
        displayName: displayName.trim(), emailVerified: true,
      });
      uid = fbUser.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-exists')
        return res.status(409).json({ error: 'Este usuario ya existe en Firebase Auth.' });
      throw err;
    }

    const userData = {
      uid, email: fullEmail,
      displayName: displayName.trim(),
      username: clean, role, type: 'local', status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: req.user.email,
    };
    const ref = await db.collection(USERS).add(userData);

    let emailSent = false;
    if (sendInvite) {
      try {
        const resetLink = await getAuth().generatePasswordResetLink(fullEmail);
        emailSent = await sendLocalInvite({ to: fullEmail, displayName: displayName.trim(), email: fullEmail, role, resetLink });
      } catch (e) { console.error('Email error:', e.message); }
    }

    return res.status(201).json({ id: ref.id, ...userData, tempPassword, emailSent });
  }

  // ── Usuario invitado (Google) ──
  const guestEmail = email?.trim().toLowerCase();
  if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))
    return res.status(400).json({ error: 'Correo de Google inválido.' });

  const existing = await db.collection(USERS).where('email', '==', guestEmail).limit(1).get();
  if (!existing.empty) return res.status(409).json({ error: 'Este correo ya está registrado.' });

  const userData = {
    uid: null, email: guestEmail,
    displayName: displayName.trim(),
    role, type: 'guest', status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: req.user.email,
  };
  const ref = await db.collection(USERS).add(userData);

  let emailSent = false;
  if (sendInvite) {
    try {
      const appUrl = `${req.protocol}://${req.get('host')}`;
      emailSent = await sendGuestInvite({ to: guestEmail, displayName: displayName.trim(), role, appUrl });
    } catch (e) { console.error('Email error:', e.message); }
  }

  res.status(201).json({ id: ref.id, ...userData, emailSent });
}));

// PATCH /api/users/:id — editar usuario (nombre y rol)
router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { displayName, role } = req.body || {};
  
  if (role && !VALID_ROLES.includes(role))
    return res.status(400).json({ error: `Rol inválido. Use: ${VALID_ROLES.join(', ')}.` });

  const id = req.params.id;

  // 1. Manejo de usuarios legados
  if (id.startsWith('legacy:')) {
    const email = id.replace(/^legacy:/, '').toLowerCase();

    if (email === config.protectedEmail)
      return res.status(403).json({ error: 'El administrador principal está protegido y no se puede editar.' });

    // Buscar el usuario en Firebase Auth para obtener su UID real y displayName si no se envía
    let uid = null;
    let authDisplayName = '';
    try {
      const authUser = await getAuth().getUserByEmail(email);
      uid = authUser.uid;
      authDisplayName = authUser.displayName || email.split('@')[0];
    } catch (err) {
      return res.status(404).json({ error: 'Usuario no encontrado en Firebase Auth.' });
    }

    const cleanDisplayName = (displayName || authDisplayName || '').trim();
    if (!cleanDisplayName)
      return res.status(400).json({ error: 'El nombre para mostrar es obligatorio.' });

    const isInternal = email.endsWith(`@${config.internalDomain}`);
    const username = isInternal ? email.split('@')[0] : null;

    // Crear el documento en Firestore
    const userData = {
      uid,
      email,
      displayName: cleanDisplayName,
      role: role || 'seller', // valor por defecto razonable
      type: isInternal ? 'local' : 'guest',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: req.user.email,
    };
    if (username) userData.username = username;

    const ref = await db.collection(USERS).add(userData);

    // Actualizar también en Firebase Auth el displayName
    try {
      await getAuth().updateUser(uid, { displayName: cleanDisplayName });
    } catch (err) {
      console.error('Error actualizando displayName en Firebase Auth:', err.message);
    }

    return res.json({ id: ref.id, displayName: cleanDisplayName, role: userData.role });
  }

  // 2. Manejo de usuarios normales en Firestore
  const ref = db.collection(USERS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const currentData = snap.data();
  if (currentData.email?.toLowerCase() === config.protectedEmail)
    return res.status(403).json({ error: 'El administrador principal está protegido y no se puede editar.' });

  const updateData = {};
  if (role) updateData.role = role;
  if (displayName !== undefined) {
    const cleanDisplayName = displayName?.trim();
    if (!cleanDisplayName)
      return res.status(400).json({ error: 'El nombre para mostrar es obligatorio.' });
    updateData.displayName = cleanDisplayName;

    // Actualizar también en Firebase Auth si el usuario tiene UID
    if (currentData.uid) {
      try {
        await getAuth().updateUser(currentData.uid, { displayName: cleanDisplayName });
      } catch (err) {
        console.error('Error actualizando displayName en Firebase Auth:', err.message);
      }
    }
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = FieldValue.serverTimestamp();
    await ref.update(updateData);
  }

  res.json({ id, ...updateData });
}));

// DELETE /api/users/:id — soft delete → papelera
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(USERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const data = snap.data();
  if (data.email?.toLowerCase() === config.protectedEmail)
    return res.status(403).json({ error: 'El administrador principal está protegido y no puede eliminarse.' });

  if (data.email === req.user.email)
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });

  const deletedAt = new Date();
  const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db.collection(TRASH).add({
    ...data,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: req.user.email,
    expiresAt,
  });

  if (data.uid && data.type === 'local') {
    try { await getAuth().updateUser(data.uid, { disabled: true }); } catch {}
  }

  await ref.delete();
  res.json({ ok: true });
}));

module.exports = router;
