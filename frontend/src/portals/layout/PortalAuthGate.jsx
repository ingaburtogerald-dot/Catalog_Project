import { usePortalAuth } from '../../hooks/usePortalAuth';

export default function PortalAuthGate({ allowedRoles, children }) {
  const { status, user, signOutPortal } = usePortalAuth(allowedRoles);

  if (status !== 'authenticated') {
    return (
      <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{
            border: '4px solid rgba(255,255,255,0.12)', borderLeftColor: 'var(--accent, #7c83ff)',
            borderRadius: '50%', width: 40, height: 40, animation: 'spin 1s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: 'var(--text-soft, #aab2cf)', fontSize: 16, fontWeight: 500 }}>
            {status === 'redirecting' ? 'Redirigiendo…' : 'Verificando sesión…'}
          </p>
        </div>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  return typeof children === 'function' ? children({ user, signOutPortal }) : children;
}
