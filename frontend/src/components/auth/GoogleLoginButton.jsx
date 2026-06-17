export default function GoogleLoginButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--bg-color)',
        color: 'var(--text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        transition: 'border-color 0.2s, opacity 0.2s',
        opacity: disabled ? 0.7 : 1,
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
  );
}
