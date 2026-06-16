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
const VALID_ROLES = config.validRoles;

function primaryRoleOf(roles) {
  return config.rolePriority.find((r) => roles.includes(r)) || roles[0] || null;
}

// Acepta `roles` (array, preferido) o `role` (string, legado) en el body de la petición.
function normalizeRoles(body) {
  const raw = Array.isArray(body.roles) ? body.roles : (body.role ? [body.role] : []);
  return [...new Set(raw.filter((r) => VALID_ROLES.includes(r)))];
}

async function deleteFromAuth(uid, email) {
  if (uid) {
    try {
      await getAuth().deleteUser(uid);
      console.log(`Successfully deleted user ${uid} from Auth.`);
      return;
    } catch (err) {
      console.error(`Error deleting user ${uid} from Auth by UID:`, err.message);
    }
  }
  if (email) {
    try {
      const userRecord = await getAuth().getUserByEmail(email.toLowerCase());
      await getAuth().deleteUser(userRecord.uid);
      console.log(`Successfully deleted user ${email} from Auth by email.`);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        console.error(`Error deleting user ${email} from Auth by email:`, err.message);
      }
    }
  }
}

function generatePassword(len = 14) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const snap = await db.collection(TRASH).where('deletedAt', '<', cutoff).get();
  for (const doc of snap.docs) {
    const data = doc.data();
    await deleteFromAuth(data.uid, data.email);
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

  const data = snap.data();
  await deleteFromAuth(data.uid, data.email);
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
        roles: role ? [role] : [],
        type: isInternal ? 'local' : 'guest',
        status: 'active',
        legacy: true,
        protected: email === config.protectedEmail,
        createdAt: null,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  // Marcar protectedEmail también en usuarios de Firestore, y normalizar `roles`
  // para usuarios legados que solo tengan el campo `role` (string) guardado.
  const withProtected = firestoreUsers.map(u => ({
    ...u,
    roles: Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : []),
    protected: u.email.toLowerCase() === config.protectedEmail,
  }));

  res.json([...withProtected, ...legacyUsers]);
}));

// POST /api/users — crear usuario local o invitado
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { type, displayName, username, email, sendInvite } = req.body || {};
  const roles = normalizeRoles(req.body || {});
  const role = primaryRoleOf(roles);

  if (!['local', 'guest'].includes(type))
    return res.status(400).json({ error: 'Tipo inválido. Use "local" o "guest".' });
  if (!displayName?.trim())
    return res.status(400).json({ error: 'El nombre para mostrar es obligatorio.' });
  if (!roles.length)
    return res.status(400).json({ error: `Selecciona al menos un rol válido. Use: ${VALID_ROLES.join(', ')}.` });

  let targetEmail = '';
  let cleanUsername = null;

  if (type === 'local') {
    if (!username?.trim())
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio.' });
    cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!cleanUsername) return res.status(400).json({ error: 'El nombre de usuario contiene caracteres inválidos.' });
    targetEmail = `${cleanUsername}@${config.internalDomain}`;
  } else {
    targetEmail = email?.trim().toLowerCase();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail))
      return res.status(400).json({ error: 'Correo de Google inválido.' });
  }

  // 1. Verificar si ya existe en activos
  const existingActive = await db.collection(USERS).where('email', '==', targetEmail).limit(1).get();
  if (!existingActive.empty) {
    return res.status(409).json({ error: 'Este correo ya está registrado.' });
  }

  // 2. Verificar papelera y limpiar rastro antes de proceder
  const existingTrash = await db.collection(TRASH).where('email', '==', targetEmail).get();
  if (!existingTrash.empty) {
    console.log(`User ${targetEmail} found in trash. Purging from trash to recreate.`);
    for (const doc of existingTrash.docs) {
      const data = doc.data();
      await deleteFromAuth(data.uid, data.email);
      await doc.ref.delete();
    }
  }

  // ── Usuario local @gyrostore.com ──
  if (type === 'local') {
    const tempPassword = generatePassword();
    let uid;
    try {
      const fbUser = await getAuth().createUser({
        email: targetEmail, password: tempPassword,
        displayName: displayName.trim(), emailVerified: true,
      });
      uid = fbUser.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        // Si por alguna razón sigue existiendo en Auth pero no en la base de datos (huérfano),
        // lo eliminamos e intentamos de nuevo una sola vez.
        try {
          const u = await getAuth().getUserByEmail(targetEmail);
          await getAuth().deleteUser(u.uid);
          const fbUser = await getAuth().createUser({
            email: targetEmail, password: tempPassword,
            displayName: displayName.trim(), emailVerified: true,
          });
          uid = fbUser.uid;
        } catch (retryErr) {
          return res.status(409).json({ error: 'Este usuario ya existe en Firebase Auth y no pudo recrearse.' });
        }
      } else {
        throw err;
      }
    }

    const userData = {
      uid, email: targetEmail,
      displayName: displayName.trim(),
      username: cleanUsername, role, roles, type: 'local', status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: req.user.email,
    };
    const ref = await db.collection(USERS).add(userData);

    const emailSent = Boolean(config.email.user && sendInvite);
    if (emailSent) {
      getAuth().generatePasswordResetLink(targetEmail)
        .then(resetLink => {
          sendLocalInvite({ to: targetEmail, displayName: displayName.trim(), email: targetEmail, role, resetLink })
            .catch(e => console.error('Email sending error:', e.message));
        })
        .catch(e => console.error('Error generating password reset link:', e.message));
    }

    return res.status(201).json({ id: ref.id, ...userData, tempPassword, emailSent });
  }

  // ── Usuario invitado (Google) ──
  // Si existiera huérfano en Auth (huella de logeo previo de un invitado), lo eliminamos
  // para que siempre sea una invitación limpia y no choque la creación.
  try {
    const u = await getAuth().getUserByEmail(targetEmail);
    await getAuth().deleteUser(u.uid);
    console.log(`Purged orphan guest auth user: ${targetEmail}`);
  } catch (err) {
    // ignorar si no existe
  }

  const userData = {
    uid: null, email: targetEmail,
    displayName: displayName.trim(),
    role, roles, type: 'guest', status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: req.user.email,
  };
  const ref = await db.collection(USERS).add(userData);

  const emailSent = Boolean(config.email.user && sendInvite);
  if (emailSent) {
    const appUrl = `${req.protocol}://${req.get('host')}`;
    sendGuestInvite({ to: targetEmail, displayName: displayName.trim(), role, appUrl })
      .catch(e => console.error('Email sending error:', e.message));
  }

  res.status(201).json({ id: ref.id, ...userData, emailSent });
}));

// PATCH /api/users/:id — editar usuario (nombre y rol)
router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { displayName } = req.body || {};
  const rolesProvided = req.body && (req.body.roles !== undefined || req.body.role !== undefined);
  const roles = rolesProvided ? normalizeRoles(req.body || {}) : null;

  if (rolesProvided && !roles.length)
    return res.status(400).json({ error: `Selecciona al menos un rol válido. Use: ${VALID_ROLES.join(', ')}.` });

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
    const finalRoles = roles && roles.length ? roles : ['seller']; // valor por defecto razonable

    // Crear el documento en Firestore
    const userData = {
      uid,
      email,
      displayName: cleanDisplayName,
      role: primaryRoleOf(finalRoles),
      roles: finalRoles,
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

    return res.json({ id: ref.id, displayName: cleanDisplayName, role: userData.role, roles: userData.roles });
  }

  // 2. Manejo de usuarios normales en Firestore
  const ref = db.collection(USERS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const currentData = snap.data();
  if (currentData.email?.toLowerCase() === config.protectedEmail)
    return res.status(403).json({ error: 'El administrador principal está protegido y no se puede editar.' });

  const updateData = {};
  if (roles && roles.length) {
    updateData.roles = roles;
    updateData.role = primaryRoleOf(roles);
  }
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
  const id = req.params.id;
  let userData;
  let docRef = null;

  if (id.startsWith('legacy:')) {
    const email = id.replace(/^legacy:/, '').toLowerCase();
    if (email === config.protectedEmail)
      return res.status(403).json({ error: 'El administrador principal está protegido y no puede eliminarse.' });

    // Buscar en Firebase Auth
    let uid = null;
    let displayName = email.split('@')[0];
    try {
      const authUser = await getAuth().getUserByEmail(email);
      uid = authUser.uid;
      displayName = authUser.displayName || displayName;
    } catch (err) {}

    const isInternal = email.endsWith(`@${config.internalDomain}`);
    userData = {
      uid, email, displayName,
      role: 'seller', roles: ['seller'], // default
      type: isInternal ? 'local' : 'guest',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: req.user.email,
    };
    if (isInternal) userData.username = email.split('@')[0];
  } else {
    docRef = db.collection(USERS).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });
    userData = snap.data();
  }

  if (userData.email?.toLowerCase() === config.protectedEmail)
    return res.status(403).json({ error: 'El administrador principal está protegido y no puede eliminarse.' });

  if (userData.email === req.user.email)
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });

  const deletedAt = new Date();
  const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db.collection(TRASH).add({
    ...userData,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: req.user.email,
    expiresAt,
  });

  if (userData.uid && userData.type === 'local') {
    try { await getAuth().updateUser(userData.uid, { disabled: true }); } catch {}
  }

  if (docRef) {
    await docRef.delete();
  }
  res.json({ ok: true });
}));

module.exports = router;
