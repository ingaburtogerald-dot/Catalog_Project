// Garantía de exclusión del bundle de producción — dos capas de protección:
//
// 1. import.meta.env.DEV → Vite lo reemplaza por `false` en producción.
//    El minificador (Rollup/Terser) detecta `if (!false) return null` → dead-code
//    elimination elimina el cuerpo del componente del bundle final.
//
// 2. VITE_DEV_EMAIL / VITE_DEV_PASSWORD vienen de .env.development.local
//    (excluido del repo por *.local en .gitignore). Esas variables son undefined
//    en producción, así que incluso si el componente llegara al bundle, el login
//    fallaría sin exponer credenciales reales.
export default function DevLoginButton({ onClick, disabled }) {
  if (!import.meta.env.DEV) return null;

  return (
    <div style={{ margin: '24px 0 0', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
      <p style={{
        fontSize: '11px',
        color: 'var(--text-soft)',
        textAlign: 'center',
        marginBottom: '10px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>
        Acceso local de desarrollo
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '10px',
          border: '1px dashed var(--border)',
          background: 'transparent',
          color: 'var(--text-soft)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 0.2s, color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-soft)';
        }}
      >
        <i className="fa-solid fa-terminal" style={{ fontSize: '12px' }} />
        Acceder como Developer Local
      </button>
      <p style={{ fontSize: '11px', color: 'var(--text-soft)', textAlign: 'center', marginTop: '8px', opacity: 0.6 }}>
        Un clic — sin escribir credenciales
      </p>
    </div>
  );
}
