// GET /api/config — datos públicos que el frontend necesita (sin secretos).
const router = require('express').Router();
const config = require('../config');

router.get('/', (req, res) => {
  res.json({
    whatsapp: config.whatsapp,
    currency: config.currency,
    volume: config.volume,
    categories: config.categories,
    oneDriveSharingUrl: config.oneDriveSharingUrl,
  });
});

module.exports = router;
