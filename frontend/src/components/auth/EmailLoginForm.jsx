import { useState } from 'react';

const inputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-soft)',
  display: 'block',
  marginBottom: '6px',
};

export default function EmailLoginForm({ onSubmit, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(email, password);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={labelStyle}>Correo electrónico</label>
        <input
          type="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Contraseña</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          style={inputStyle}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn-solid"
        style={{ padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginTop: '4px' }}
      >
        {loading ? (
          <>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '8px' }} />
            Verificando...
          </>
        ) : (
          'Iniciar Sesión'
        )}
      </button>
    </form>
  );
}
