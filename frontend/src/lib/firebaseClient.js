// Cliente Firebase singleton para los portales internos React.
// Importa desde el mismo CDN ESM que usan los portales legacy (admin.js, vendedor.js, etc.)
// para mantener compatibilidad de versión mientras convive con ese código.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

let authInstance = null;

export async function getFirebaseAuth() {
  if (authInstance) return authInstance;

  const res = await fetch('/api/auth/config');
  const fbConfig = await res.json();
  if (!fbConfig.configured) throw new Error('Firebase no está configurado en el servidor.');

  const app = getApps().length ? getApps()[0] : initializeApp(fbConfig);
  authInstance = getAuth(app);
  return authInstance;
}

export {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged,
};
