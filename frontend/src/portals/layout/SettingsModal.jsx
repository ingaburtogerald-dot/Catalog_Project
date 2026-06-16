import { useState } from 'react';

export default function SettingsModal({ theme, onThemeChange, onClose, onLogout }) {
  const [selected, setSelected] = useState(theme);

  function handleSubmit(e) {
    e.preventDefault();
    localStorage.setItem('gyro_admin_theme', selected);
    onThemeChange(selected);
    onClose();
  }

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>Configuración</h2>
          <button type="button" className="close-modal-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div className="grid-form" style={{ gridTemplateColumns: '1fr' }}>
            <label>
              Tema
              <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="dark">Oscuro (Dark)</option>
                <option value="light">Claro (Light)</option>
              </select>
            </label>
          </div>
          <div style={{
            marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <button
              type="button" className="btn-ghost" onClick={onLogout}
              style={{ color: 'var(--danger)', background: 'rgba(239,68,68,.15)', border: 'none' }}
            >
              Cerrar Sesión
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-solid">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
