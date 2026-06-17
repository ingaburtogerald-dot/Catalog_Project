import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

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

export { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged };
