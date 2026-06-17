import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { GoogleStrategy } from '../auth/strategies/GoogleStrategy';
import { EmailStrategy } from '../auth/strategies/EmailStrategy';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';
import EmailLoginForm from '../components/auth/EmailLoginForm';
import DevLoginButton from '../components/auth/DevLoginButton';

const PORTAL_BY_ROLE = {
  admin: '/inventario',
  global_admin: '/inventario',
  seller: '/vendedor.html',
  cashier: '/vendedor.html',
  logistics_admin: '/gyrologistics',
  logistics_customer: '/gyrologistics',
};

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '';
  const { user, status, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirigir si la sesión ya estaba activa al llegar al login
  useEffect(() => {
    if (status === 'authenticated' && user) {
      window.location.href = returnTo || PORTAL_BY_ROLE[user.role] || '/inventario';
    }
  }, [status, user, returnTo]);

  async function handleLogin(strategy, fallbackError) {
    setLoading(true);
    setError('');
    try {
      const sessionUser = await login(strategy);
      window.location.href = returnTo || PORTAL_BY_ROLE[sessionUser.role] || '/inventario';
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(fallbackError || err.message || 'Error al iniciar sesión.');
      }
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleLogin = () =>
    handleLogin(new GoogleStrategy(), 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.');

  const handleEmailLogin = (email, password) =>
    handleLogin(new EmailStrategy(email, password), 'Correo o contraseña incorrectos. Verifica tus datos.');

  // DevStrategy se importa dinámicamente para que Rollup no la incluya
  // en el chunk principal de producción cuando import.meta.env.DEV es false.
  async function handleDevLogin() {
    if (!import.meta.env.DEV) return;
    const { DevStrategy } = await import('../auth/strategies/DevStrategy');
    await handleLogin(
      new DevStrategy(),
      'Error en acceso dev. Verifica VITE_DEV_EMAIL y VITE_DEV_PASSWORD en .env.development.local',
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--surface)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        padding: '40px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href="/" style={{ display: 'inline-block' }}>
            <img
              src="/assets/img/Gyro_Store_logo.jpeg"
              alt="Gyro Store"
              style={{ width: '72px', height: '72px', borderRadius: '16px', display: 'block', margin: '0 auto 16px' }}
            />
          </a>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px', color: 'var(--heading-color)' }}>
            Iniciar Sesión
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '14px', margin: 0 }}>
            Accede a tu cuenta de Gyro Store
          </p>
          {returnTo && (
            <p style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '8px', fontWeight: 500 }}>
              <i className="fa-solid fa-arrow-right" style={{ marginRight: '6px' }} />
              Serás redirigido a donde estabas
            </p>
          )}
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginTop: '2px', flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <GoogleLoginButton onClick={handleGoogleLogin} disabled={loading} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-soft)', fontSize: '12px', whiteSpace: 'nowrap' }}>o con correo</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <EmailLoginForm onSubmit={handleEmailLogin} loading={loading} />

        <DevLoginButton onClick={handleDevLogin} disabled={loading} />

        <p style={{ textAlign: 'center', margin: '20px 0 0', fontSize: '13px', color: 'var(--text-soft)' }}>
          <a href="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            ← Volver al catálogo
          </a>
        </p>
      </div>
    </div>
  );
}
