// Almacenamiento de fotos del portal Gyro Logistics en Firebase Storage.
// Requiere que el proyecto de Firebase tenga el plan "Blaze" (pago por uso) activado,
// y la variable FIREBASE_STORAGE_BUCKET configurada en .env.
require('./firebase'); // asegura que admin.initializeApp() ya corrió (con storageBucket)
const { getStorage } = require('firebase-admin/storage');

function sanitizePathSegment(segment) {
  return String(segment || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim() || 'sin-nombre';
}

// Sube un archivo y devuelve su URL pública.
async function uploadFile(buffer, folderPath, filename, mimeType) {
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('La foto es demasiado grande (máx. 8MB). Intenta comprimirla antes de subirla.');
  }
  const bucket = getStorage().bucket();
  const destPath = `${folderPath}/${filename}`;
  const file = bucket.file(destPath);

  await file.save(buffer, { metadata: { contentType: mimeType || 'application/octet-stream' } });
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${destPath}`;
}

module.exports = { uploadFile, sanitizePathSegment };
