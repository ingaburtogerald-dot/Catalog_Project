import { useCallback, useEffect, useRef, useState } from 'react';
import { getFirebaseAuth, onAuthStateChanged, signOut } from '../lib/firebaseClient';

// A qué portal redirigir según el rol resuelto, cuando el rol actual no tiene
// acceso a la página donde está parado. Debe mantenerse en sync con la lista
// PORTALS de assets/js/auth-global.js mientras conviven ambas arquitecturas.
const PORTAL_BY_ROLE = {
  admin: '/inventario',
  global_admin: '/inventario',
  seller: '/vendedor.html',
  cashier: '/vendedor.html',
  logistics_admin: '/gyrologistics',
  logistics_customer: '/gyrologistics',
};

function clearGyroSession() {
  localStorage.removeItem('gyro_admin_logged_in');
  localStorage.removeItem('gyro_admin_dev_mode');
  localStorage.removeItem('gyro_user_name');
  localStorage.removeItem('gyro_user_photo');
  localStorage.removeItem('gyro_user_role');
  localStorage.removeItem('gyro_user_roles');
  localStorage.removeItem('gyro_last_activity');
  sessionStorage.removeItem('gyro_welcome_shown');
}

function redirectToLogin() {
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?returnTo=${returnTo}`;
}

// Hook de auth compartido para portales internos en React.
// Reemplaza el boilerplate de Firebase+redirects duplicado en cada *.js legacy.
// IMPORTANTE: escribe las MISMAS claves de localStorage que ya leen
// frontend/src/hooks/useUserRoles.js y assets/js/auth-global.js — no inventar
// un esquema nuevo, porque el catálogo y los portales legacy dependen de esto.
export function usePortalAuth(allowedRoles) {
  const [status, setStatus] = useState('loading'); // loading | authenticated | redirecting
  const [user, setUser] = useState(null);
  const allowedRolesRef = useRef(allowedRoles);
  allowedRolesRef.current = allowedRoles;

  useEffect(() => {
    let unsubscribe = () => {};

    async function init() {
      const params = new URLSearchParams(window.location.search);

      // Logout explícito (ej. desde el portal-switcher o el botón de cerrar sesión).
      if (params.get('logout') === 'true') {
        clearGyroSession();
        try {
          const auth = await getFirebaseAuth();
          await signOut(auth).catch(() => {});
        } catch { /* sin Firebase configurado, no pasa nada */ }
        window.location.href = params.get('from') || '/';
        return;
      }

      let auth;
      try {
        auth = await getFirebaseAuth();
      } catch (err) {
        setStatus('redirecting');
        redirectToLogin();
        return;
      }

      unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!fbUser) {
          setStatus('redirecting');
          redirectToLogin();
          return;
        }

        try {
          const token = await fbUser.getIdToken();
          const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          const me = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(me.error || `Error ${res.status}`);

          const roles = me.roles || (me.role ? [me.role] : []);
          const isAllowed = allowedRolesRef.current.some((r) => roles.includes(r)) || roles.includes('global_admin');

          // Persistir sesión con las claves compartidas con el resto del sitio.
          localStorage.setItem('gyro_admin_logged_in', 'true');
          localStorage.setItem('gyro_user_name', fbUser.displayName || me.email.split('@')[0] || '');
          localStorage.setItem('gyro_user_photo', fbUser.photoURL || '');
          localStorage.setItem('gyro_user_role', me.role || '');
          localStorage.setItem('gyro_user_roles', JSON.stringify(roles));

          if (!isAllowed) {
            setStatus('redirecting');
            const dest = PORTAL_BY_ROLE[me.role] || '/login';
            window.location.href = dest;
            return;
          }

          setUser({
            uid: fbUser.uid,
            email: me.email,
            name: fbUser.displayName || me.email.split('@')[0],
            photoURL: fbUser.photoURL || '',
            role: me.role,
            roles,
            getIdToken: () => fbUser.getIdToken(),
          });
          setStatus('authenticated');
        } catch (err) {
          setStatus('redirecting');
          redirectToLogin();
        }
      });
    }

    init();
    return () => unsubscribe();
  }, []);

  const signOutPortal = useCallback(async () => {
    clearGyroSession();
    try {
      const auth = await getFirebaseAuth();
      await signOut(auth).catch(() => {});
    } catch { /* noop */ }
    window.location.href = '/';
  }, []);

  return { status, user, signOutPortal };
}
