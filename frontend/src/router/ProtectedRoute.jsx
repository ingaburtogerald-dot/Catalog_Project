import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

// Mapa de rol → portal de destino. Mantener en sync con GlobalNav.jsx y AuthContext.jsx.
const PORTAL_BY_ROLE = {
  admin: '/inventario',
  global_admin: '/inventario',
  seller: '/vendedor.html',
  cashier: '/vendedor.html',
  logistics_admin: '/gyrologistics',
  logistics_customer: '/gyrologistics',
};

// Reemplaza a PortalAuthGate. Lee el estado desde AuthContext (único listener de Firebase)
// en vez de iniciar su propia suscripción a onAuthStateChanged por cada ruta.
//
// Mantiene la interfaz de render-prop para no tener que tocar los portales:
//   <ProtectedRoute allowedRoles={['admin']}>
//     {({ user, signOutPortal }) => <MiPortal user={user} signOutPortal={signOutPortal} />}
//   </ProtectedRoute>
export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
      return;
    }

    if (user) {
      const isAllowed = user.roles.includes('global_admin') || allowedRoles.some((r) => user.roles.includes(r));
      if (!isAllowed) {
        window.location.href = PORTAL_BY_ROLE[user.role] || '/login';
      }
    }
  }, [status, user, allowedRoles, navigate]);

  if (status !== 'authenticated' || !user) {
    return (
      <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              border: '4px solid rgba(255,255,255,0.12)',
              borderLeftColor: 'var(--accent, #7c83ff)',
              borderRadius: '50%',
              width: 40,
              height: 40,
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: 'var(--text-soft, #aab2cf)', fontSize: 16, fontWeight: 500 }}>
            {status === 'unauthenticated' ? 'Redirigiendo…' : 'Verificando sesión…'}
          </p>
        </div>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  const isAllowed = user.roles.includes('global_admin') || allowedRoles.some((r) => user.roles.includes(r));
  if (!isAllowed) return null;

  return typeof children === 'function' ? children({ user, signOutPortal: logout }) : children;
}
