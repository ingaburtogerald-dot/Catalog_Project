// Rutas de autenticación del panel admin.
const router = require('express').Router();
const config = require('../config');
const requireAdmin = require('../middleware/auth');

// GET /api/auth/config — config pública de la Web App de Firebase (para el login del navegador).
router.get('/config', (req, res) => {
  res.json({ ...config.firebaseWeb, configured: Boolean(config.firebaseWeb.apiKey) });
});

// GET /api/auth/me — confirma que el token es válido y la cuenta es admin.
router.get('/me', requireAdmin, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name });
});

module.exports = router;
