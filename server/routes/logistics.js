// Portal Gyro Logistics: clientes registran compras/paquetes desde China,
// el equipo de logística confirma cada etapa hasta la llegada a Nicaragua.
const router = require('express').Router();
const multer = require('multer');
const { db, FieldValue } = require('../firebase');
const { requireLogisticsAdmin, requireLogisticsAny } = require('../middleware/auth');
const { asyncHandler } = require('../utils');
const storage = require('../storage');
const { sendLogisticsAdminAlert, sendLogisticsStatusEmail } = require('../email');
const config = require('../config');

const SHIPMENTS = config.collections.logisticsShipments;
const STATUS_FLOW = ['compra_china', 'recibido_china', 'recibido_nicaragua'];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function isAdminLike(roles = []) {
  return roles.includes('admin') || roles.includes('global_admin') || roles.includes('logistics_admin');
}

// GET /api/logistics/shipments — admins ven todo, clientes solo lo suyo.
router.get('/shipments', requireLogisticsAny, asyncHandler(async (req, res) => {
  let docs;
  if (isAdminLike(req.user.roles)) {
    const snap = await db.collection(SHIPMENTS).orderBy('createdAt', 'desc').get();
    docs = snap.docs;
  } else {
    // Filtro de un solo campo (sin orderBy) para evitar requerir índice compuesto en Firestore.
    const snap = await db.collection(SHIPMENTS).where('customerUid', '==', req.user.uid).get();
    docs = snap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
  }
  res.json(docs.map((d) => ({ id: d.id, ...d.data() })));
}));

// POST /api/logistics/shipments — el cliente crea una nueva revisión de paquete.
router.post('/shipments', requireLogisticsAny, upload.single('photo'), asyncHandler(async (req, res) => {
  const { purchaseDate, shippingNumber } = req.body || {};
  if (!purchaseDate?.trim()) return res.status(400).json({ error: 'La fecha de compra es obligatoria.' });
  if (!shippingNumber?.trim()) return res.status(400).json({ error: 'El número de envío es obligatorio.' });

  let photoUrl = '';
  if (req.file) {
    const customerSlug = storage.sanitizePathSegment(req.user.name || req.user.email.split('@')[0]);
    const shortUid = (req.user.uid || req.user.email).slice(0, 8);
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    const folderPath = `${config.logisticsPhotosFolder}/${customerSlug}_${shortUid}`;
    const filename = `${Date.now()}${ext}`;
    photoUrl = await storage.uploadFile(req.file.buffer, folderPath, filename, req.file.mimetype);
  }

  const data = {
    customerUid: req.user.uid,
    customerEmail: req.user.email,
    customerDisplayName: req.user.name || req.user.email,
    purchaseDate: purchaseDate.trim(),
    shippingNumber: shippingNumber.trim(),
    photoUrl,
    status: 'compra_china',
    history: [{ status: 'compra_china', comment: '', by: req.user.email, at: new Date().toISOString() }],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(SHIPMENTS).add(data);

  // Notificar a los admins de logística (sin esperar, igual al patrón de invitaciones existente).
  db.collection(config.collections.users)
    .where('roles', 'array-contains-any', ['admin', 'global_admin', 'logistics_admin'])
    .get()
    .then((snap) => {
      const firestoreAdmins = snap.docs
        .map((d) => d.data())
        .filter((u) => u.status === 'active')
        .map((u) => u.email)
        .filter(Boolean);
      const allEmails = [...new Set([...firestoreAdmins, ...config.adminEmails])];
      if (allEmails.length) {
        sendLogisticsAdminAlert({
          toEmails: allEmails,
          customerName: data.customerDisplayName,
          shippingNumber: data.shippingNumber,
          purchaseDate: data.purchaseDate,
          photoUrl,
        }).catch((e) => console.error('Error enviando alerta de logística:', e.message));
      }
    })
    .catch((e) => console.error('Error buscando admins de logística:', e.message));

  res.status(201).json({ id: ref.id, ...data });
}));

// PATCH /api/logistics/shipments/:id/advance — el admin avanza la revisión a la siguiente etapa.
router.patch('/shipments/:id/advance', requireLogisticsAdmin, asyncHandler(async (req, res) => {
  const { comment } = req.body || {};
  if (!comment?.trim()) return res.status(400).json({ error: 'El comentario es obligatorio.' });

  const ref = db.collection(SHIPMENTS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Revisión no encontrada.' });

  const current = snap.data();
  const idx = STATUS_FLOW.indexOf(current.status);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) {
    return res.status(400).json({ error: 'Esta revisión ya está en su estado final.' });
  }
  const nextStatus = STATUS_FLOW[idx + 1];
  const historyEntry = { status: nextStatus, comment: comment.trim(), by: req.user.email, at: new Date().toISOString() };

  await ref.update({
    status: nextStatus,
    updatedAt: FieldValue.serverTimestamp(),
    history: FieldValue.arrayUnion(historyEntry),
  });

  sendLogisticsStatusEmail({
    to: current.customerEmail,
    customerName: current.customerDisplayName,
    status: nextStatus,
    comment: comment.trim(),
  }).catch((e) => console.error('Error enviando email de estado:', e.message));

  res.json({ id: req.params.id, status: nextStatus, history: historyEntry });
}));

module.exports = router;
