// Servidor Express: sirve el frontend (raíz del proyecto) y expone la API REST.
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('./config');
const { startCronJobs } = require('./cron');

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
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/logistics', require('./routes/logistics'));
app.use('/api/inventory', require('./routes/inventory'));

// Páginas servidas por la SPA de React/Vite en frontend/dist. Agregar aquí cada
// *.html a medida que se vaya migrando de vanilla JS a React (ver plan de migración
// de portales). Si el build aún no existe (npm run build dentro de frontend/), no se
// monta nada aquí y todas caen a los archivos legacy servidos por publicDir más abajo.
const REACT_ROUTES = ['/', '/index.html', '/login', '/producto.html', '/vendedor.html', '/catalogo-admin.html', '/inventario', '/gyrologistics', '/reportes', '/usuarios'];

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const frontendIndexPath = path.join(frontendDist, 'index.html');
if (fs.existsSync(frontendIndexPath)) {
  // Los assets de Vite llevan hash en el nombre (immutables): se pueden cachear
  // para siempre. Pero el index.html NO debe cachearse, porque es el que apunta a
  // los bundles nuevos tras cada build; si el navegador lo reusa, sigue cargando
  // CSS/JS viejos (íconos en posición vieja, estilos desactualizados, etc.).
  app.use(express.static(frontendDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.includes(`${path.sep}vite-assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  app.get(REACT_ROUTES, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(frontendIndexPath);
  });
}

// Servir el resto del sitio (portales internos) directamente desde la raíz del proyecto
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
  console.log(`\n🚀 Gyro Store en línea (VERSIÓN ACTUALIZADA V5)`);
  console.log(`   Catálogo (Local):     http://localhost:${config.port}/`);
  if (localIps.length > 0) {
    localIps.forEach(ip => {
      console.log(`   Catálogo (Red Local):  http://${ip}:${config.port}/`);
      console.log(`   Admin (Red Local):     http://${ip}:${config.port}/inventario`);
    });
  } else {
    console.log(`   Inventario (Local):   http://localhost:${config.port}/inventario`);
  }
  console.log(`   API:                  http://localhost:${config.port}/api/products\n`);

  // Iniciar Cron Jobs en background
  startCronJobs();
});
