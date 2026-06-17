import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { getFirebaseAuth, signOut, onAuthStateChanged } from './services/firebaseAuth';
import { getMe } from './services/authApi';

export const AuthContext = createContext(null);

// Claves compartidas con useUserRoles.js (sidebar de la tienda pública).
// persistSession las escribe, clearSession las borra. No inventar un esquema diferente.
const SESSION_KEYS = [
  'gyro_admin_logged_in',
  'gyro_admin_dev_mode',
  'gyro_user_name',
  'gyro_user_photo',
  'gyro_user_role',
  'gyro_user_roles',
  'gyro_last_activity',
];

function buildSessionUser(fbUser, me) {
  const roles = me.roles || (me.role ? [me.role] : []);
  return {
    uid: fbUser.uid,
    email: me.email,
    name: fbUser.displayName || me.email.split('@')[0],
    photoURL: fbUser.photoURL || '',
    role: me.role,
    roles,
    getIdToken: () => fbUser.getIdToken(),
  };
}

function persistSession(user) {
  localStorage.setItem('gyro_admin_logged_in', 'true');
  localStorage.setItem('gyro_user_name', user.name || '');
  localStorage.setItem('gyro_user_photo', user.photoURL || '');
  localStorage.setItem('gyro_user_role', user.role || '');
  localStorage.setItem('gyro_user_roles', JSON.stringify(user.roles || []));
}

function clearSession() {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem('gyro_welcome_shown');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated

  // Evita la doble llamada a getMe cuando login() ya resolvió al usuario.
  // onAuthStateChanged dispara inmediatamente después de signIn — sin esta bandera
  // haríamos dos fetch a /api/auth/me por cada login.
  const justLoggedIn = useRef(false);

  useEffect(() => {
    let unsub = () => {};

    async function init() {
      // Soporte para logout explícito vía query param (ej. ?logout=true&from=/inventario)
      const params = new URLSearchParams(window.location.search);
      if (params.get('logout') === 'true') {
        clearSession();
        try {
          const auth = await getFirebaseAuth();
          await signOut(auth).catch(() => {});
        } catch { /* Firebase puede no estar configurado */ }
        window.location.href = params.get('from') || '/';
        return;
      }

      let auth;
      try {
        auth = await getFirebaseAuth();
      } catch {
        // Firebase no configurado — el usuario no puede autenticarse
        setStatus('unauthenticated');
        return;
      }

      unsub = onAuthStateChanged(auth, async (fbUser) => {
        // Si login() ya manejó este cambio de estado, lo saltamos
        if (justLoggedIn.current) {
          justLoggedIn.current = false;
          return;
        }

        if (!fbUser) {
          clearSession();
          setUser(null);
          setStatus('unauthenticated');
          return;
        }

        // Restauración de sesión tras refresco de página
        try {
          const token = await fbUser.getIdToken();
          const me = await getMe(token);
          const sessionUser = buildSessionUser(fbUser, me);
          persistSession(sessionUser);
          setUser(sessionUser);
          setStatus('authenticated');
        } catch {
          clearSession();
          setUser(null);
          setStatus('unauthenticated');
        }
      });
    }

    init();
    return () => unsub();
  }, []);

  const login = useCallback(async (strategy) => {
    justLoggedIn.current = true;
    const sessionUser = await strategy.execute();
    persistSession(sessionUser);
    setUser(sessionUser);
    setStatus('authenticated');
    return sessionUser;
  }, []);

  const logout = useCallback(async () => {
    clearSession();
    setUser(null);
    setStatus('unauthenticated');
    try {
      const auth = await getFirebaseAuth();
      await signOut(auth).catch(() => {});
    } catch { /* noop */ }
    window.location.href = '/';
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
