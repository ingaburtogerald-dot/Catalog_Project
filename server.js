// ============================================
// GYRO STORE - SERVIDOR DE DESARROLLO LOCAL
// Creado por Antigravity (AI) para Ing. Gerald Aburto
// ============================================

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir todos los archivos estáticos desde el directorio raíz del proyecto
app.use(express.static(__dirname));

// Si un usuario accede a una ruta que no existe, podemos redirigirlo al index.html o mostrar un 404 personalizado
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log('====================================================');
  console.log('⚡ ¡Servidor local de Gyro Store iniciado con éxito!');
  console.log(`🌐 Accede en tu navegador: http://localhost:${PORT}`);
  console.log('💻 Presiona Ctrl + C para detener el servidor');
  console.log('====================================================');
});
