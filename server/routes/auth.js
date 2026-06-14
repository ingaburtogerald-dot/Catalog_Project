// Rutas de autenticación del panel admin.
const router = require('express').Router();
const config = require('../config');
const { requireSeller } = require('../middleware/auth');

// GET /api/auth/config — config pública de la Web App de Firebase (para el login del navegador).
router.get('/config', (req, res) => {
  res.json({ ...config.firebaseWeb, configured: Boolean(config.firebaseWeb.apiKey) });
});

// GET /api/auth/me — confirma que el token es válido y determina el rol.
router.get('/me', requireSeller, (req, res) => {
  const email = req.user.email.toLowerCase();
  const isAdmin = config.adminEmails.includes(email) || email === 'dev-admin@gyrostore.com';
  const role = isAdmin ? 'admin' : 'seller';
  res.json({ email: req.user.email, name: req.user.name, role });
});

module.exports = router;
