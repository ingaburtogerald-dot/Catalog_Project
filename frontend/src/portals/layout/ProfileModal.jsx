const ROLE_LABELS = {
  global_admin: 'Administrador Global',
  admin: 'Administrador',
  seller: 'Vendedor',
  cashier: 'Cajero',
  logistics_admin: 'Admin de Logística',
  logistics_customer: 'Cliente de Logística',
};

export default function ProfileModal({ user, onClose }) {
  const roles = user?.roles || [];

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h2>Mi Perfil</h2>
          <button type="button" className="close-modal-btn" onClick={onClose}>&times;</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <img
            src={user?.photoURL || '/assets/img/Gyro_Store_logo.jpeg'}
            alt="Foto de perfil"
            style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid var(--accent)' }}
          />
          {user?.displayName && (
            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--heading-color)' }}>{user.displayName}</h3>
          )}
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-soft)', fontWeight: 600 }}>{user?.email}</p>

          <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
            <p className="muted-note" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: 8 }}>
              Roles
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roles.length === 0 ? (
                <span className="muted-note">Sin roles asignados</span>
              ) : (
                roles.map((r) => (
                  <span
                    key={r}
                    className="badge"
                    style={{ background: 'rgba(14,165,233,0.15)', color: 'var(--accent-soft)', border: '1px solid var(--border-strong)' }}
                  >
                    {ROLE_LABELS[r] || r}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
