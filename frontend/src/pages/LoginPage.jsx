import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getFirebaseAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
} from '../lib/firebaseClient';

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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function afterLogin(fbUser) {
    const token = await fbUser.getIdToken();
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(me.error || 'Error al verificar tu cuenta');

    const roles = me.roles || (me.role ? [me.role] : []);
    localStorage.setItem('gyro_admin_logged_in', 'true');
    localStorage.setItem('gyro_user_name', fbUser.displayName || me.email?.split('@')[0] || '');
    localStorage.setItem('gyro_user_photo', fbUser.photoURL || '');
    localStorage.setItem('gyro_user_role', me.role || '');
    localStorage.setItem('gyro_user_roles', JSON.stringify(roles));

    const dest = returnTo || PORTAL_BY_ROLE[me.role] || '/';
    window.location.href = dest;
  }

  async function loginWithGoogle() {
    setLoading(true);
    setError('');
    try {
      const auth = await getFirebaseAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await afterLogin(result.user);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loginWithEmail(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const auth = await getFirebaseAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);
      await afterLogin(result.user);
    } catch {
      setError('Correo o contraseña incorrectos. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
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
              <i className="fa-solid fa-arrow-right" style={{ marginRight: '6px' }}></i>
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
            <i className="fa-solid fa-triangle-exclamation" style={{ marginTop: '2px', flexShrink: 0 }}></i>
            {error}
          </div>
        )}

        <button
          onClick={loginWithGoogle}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'var(--bg-color)',
            color: 'var(--text)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '20px',
            transition: 'border-color 0.2s, opacity 0.2s',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt=""
            width="18"
            style={{ flexShrink: 0 }}
          />
          Continuar con Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-soft)', fontSize: '12px', whiteSpace: 'nowrap' }}>o con correo</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <form onSubmit={loginWithEmail} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '6px' }}>
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--text)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '6px' }}>
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--text)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-solid"
            style={{ padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginTop: '4px' }}
          >
            {loading
              ? <><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i>Verificando...</>
              : 'Iniciar Sesión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', margin: '28px 0 0', fontSize: '13px', color: 'var(--text-soft)' }}>
          <a href="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            ← Volver al catálogo
          </a>
        </p>
      </div>
    </div>
  );
}
