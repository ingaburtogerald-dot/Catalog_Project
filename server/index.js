// Servidor Express: sirve el frontend (raíz del proyecto) y expone la API REST.
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const config = require('./config');

require('./firebase'); // inicializa Firebase Admin

const app = express();

app.use(cors());
app.use(express.json());

// Log mínimo de peticiones a la API
app.use('/api', (req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Rutas de la API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/config', require('./routes/config'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/users',    require('./routes/users'));

// Servir frontend estático directamente desde la raíz del proyecto
const publicDir = path.join(__dirname, '..');
app.use(express.static(publicDir));

// Healthcheck
app.get('/api/health', (req, res) => res.json({ ok: true }));

// 404 para API no encontrada
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint no encontrado.' }));

// Manejador central de errores
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

function getLocalIpAddresses() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

app.listen(config.port, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log(`\n🚀 Gyro Store en línea`);
  console.log(`   Catálogo (Local):     http://localhost:${config.port}/`);
  if (localIps.length > 0) {
    localIps.forEach(ip => {
      console.log(`   Catálogo (Red Local):  http://${ip}:${config.port}/`);
      console.log(`   Admin (Red Local):     http://${ip}:${config.port}/admin.html`);
    });
  } else {
    console.log(`   Admin (Local):        http://localhost:${config.port}/admin.html`);
  }
  console.log(`   API:                  http://localhost:${config.port}/api/products\n`);
});
