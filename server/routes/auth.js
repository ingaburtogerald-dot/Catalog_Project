// Rutas de autenticación del panel admin.
const router = require('express').Router();
const config = require('../config');
const { requireAnyRole } = require('../middleware/auth');

// GET /api/auth/config — config pública de la Web App de Firebase (para el login del navegador).
router.get('/config', (req, res) => {
  res.json({ ...config.firebaseWeb, configured: Boolean(config.firebaseWeb.apiKey) });
});

// GET /api/auth/me — confirma token y devuelve rol(es) resueltos desde Firestore o env vars.
// El middleware requireAnyRole ya resolvió req.user.roles vía resolveRoles().
router.get('/me', requireAnyRole, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name, role: req.user.role, roles: req.user.roles });
});

module.exports = router;
