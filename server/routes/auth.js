// Rutas de autenticación del panel admin.
const router = require('express').Router();
const config = require('../config');
const { requireSeller } = require('../middleware/auth');

// GET /api/auth/config — config pública de la Web App de Firebase (para el login del navegador).
router.get('/config', (req, res) => {
  res.json({ ...config.firebaseWeb, configured: Boolean(config.firebaseWeb.apiKey) });
});

// GET /api/auth/me — confirma token y devuelve rol resuelto desde Firestore o env vars.
// El middleware requireSeller ya resolvió req.user.role vía resolveRole().
router.get('/me', requireSeller, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name, role: req.user.role });
});

module.exports = router;
