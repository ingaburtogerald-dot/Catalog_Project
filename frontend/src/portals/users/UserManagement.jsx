import { useCallback, useEffect, useMemo, useState } from 'react';
import PortalLayout from '../layout/PortalLayout';
import { authedFetch } from '../lib/portalApi';
import { usePortalToast } from '../../hooks/usePortalToast';

const ALL_ROLES = [
  { id: 'global_admin',       label: 'Global Admin',       color: '#ef4444' },
  { id: 'admin',              label: 'Admin',               color: '#f59e0b' },
  { id: 'seller',             label: 'Vendedor',            color: '#7c83ff' },
  { id: 'cashier',            label: 'Cajero',              color: '#10b981' },
  { id: 'logistics_admin',    label: 'Logistics Admin',     color: '#0ea5e9' },
  { id: 'logistics_customer', label: 'Logistics Customer',  color: '#22c55e' },
];

function roleInfo(id) {
  return ALL_ROLES.find(r => r.id === id) || { id, label: id, color: 'var(--muted)' };
}

function RolePill({ roleId }) {
  const r = roleInfo(roleId);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, color: r.color, background: `${r.color}18`, border: `1px solid ${r.color}25`, marginRight: '4px', marginBottom: '4px' }}>
      {r.label}
    </span>
  );
}

// ─── UserModal (create + edit) ─────────────────────────────────────────────────
function UserModal({ user: editUser, onConfirm, onCancel }) {
  const isEdit = !!editUser;
  const [form, setForm] = useState({
    displayName: editUser?.displayName || '',
    email: editUser?.email || '',
    type: editUser?.type || 'local',
    roles: editUser?.roles || [],
    password: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function toggleRole(id) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(id) ? f.roles.filter(r => r !== id) : [...f.roles, id],
    }));
  }

  const valid = form.displayName.trim() && (isEdit || form.email.trim()) && form.roles.length > 0 && (isEdit || form.type === 'google' || form.password.length >= 6);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', maxWidth: '460px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: 700 }}>
          {isEdit ? 'Editar Usuario' : 'Crear Usuario'}
        </h3>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre completo *</label>
          <input type="text" value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Ej. María García" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '14px' }} />
        </div>

        {!isEdit && (
          <>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo de cuenta *</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[{ id: 'local', label: 'Local (@gyrostore.com)', icon: 'fa-envelope' }, { id: 'google', label: 'Google (invitado)', icon: 'fa-google' }].map(t => (
                  <button key={t.id} type="button" onClick={() => set('type', t.id)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1.5px solid ${form.type === t.id ? 'var(--accent)' : 'var(--input-border)'}`, background: form.type === t.id ? 'rgba(124,131,255,0.08)' : 'var(--input-bg)', color: form.type === t.id ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700 }}>
                    <i className={`fa-brands ${t.icon}`} style={{ marginRight: '6px' }}></i>{t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder={form.type === 'local' ? 'usuario@gyrostore.com' : 'usuario@gmail.com'} style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '14px' }} />
              </div>
            </div>

            {form.type === 'local' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contraseña * (mín. 6 caracteres)</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '14px' }} />
              </div>
            )}
          </>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Roles * (selecciona al menos uno)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ALL_ROLES.map(r => {
              const selected = form.roles.includes(r.id);
              return (
                <button key={r.id} type="button" onClick={() => toggleRole(r.id)} style={{ padding: '6px 14px', borderRadius: '20px', border: `1.5px solid ${selected ? r.color : 'var(--border)'}`, background: selected ? `${r.color}18` : 'transparent', color: selected ? r.color : 'var(--text-soft)', fontWeight: 700, cursor: 'pointer', fontSize: '12.5px', transition: 'all 0.15s' }}>
                  {selected && <i className="fa-solid fa-check" style={{ marginRight: '5px', fontSize: '10px' }}></i>}
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancelar</button>
          <button onClick={() => valid && onConfirm(form)} disabled={!valid} style={{ flex: 1, padding: '11px', borderRadius: '20px', border: 'none', background: valid ? 'var(--accent)' : 'rgba(124,131,255,0.3)', color: '#fff', fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed', fontSize: '14px' }}>
            {isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ConfirmDeleteModal ────────────────────────────────────────────────────────
function ConfirmDeleteModal({ user, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🗑️</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700 }}>Eliminar Usuario</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-soft)', fontSize: '14px' }}>
          ¿Eliminar a <strong style={{ color: 'var(--text)' }}>{user.displayName || user.email}</strong>? El usuario irá a la papelera y se eliminará definitivamente en 30 días.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '11px', borderRadius: '20px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function UserManagement({ user: adminUser, signOutPortal }) {
  const [users, setUsers] = useState([]);
  const [trashedUsers, setTrashedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [modal, setModal] = useState(null); // null | { type: 'create' | 'edit' | 'delete', user? }
  const [processing, setProcessing] = useState(null);
  const { toast, toastMsg, toastShow } = usePortalToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [active, trashed] = await Promise.all([
        authedFetch('/users', adminUser),
        authedFetch('/users?trashed=true', adminUser).catch(() => []),
      ]);
      setUsers(Array.isArray(active) ? active : []);
      setTrashedUsers(Array.isArray(trashed) ? trashed : []);
    } catch (err) {
      toast(`Error al cargar usuarios: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [adminUser]);

  useEffect(() => { load(); }, [load]);

  const roleStats = useMemo(() => {
    const m = {};
    ALL_ROLES.forEach(r => { m[r.id] = 0; });
    users.forEach(u => u.roles?.forEach(r => { if (m[r] !== undefined) m[r]++; }));
    return m;
  }, [users]);

  const filteredUsers = useMemo(() => users.filter(u => {
    const matchSearch = !search || u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.roles?.includes(filterRole);
    return matchSearch && matchRole;
  }), [users, search, filterRole]);

  async function handleCreate(data) {
    setProcessing('create');
    try {
      await authedFetch('/users', adminUser, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      toast('Usuario creado exitosamente.');
      setModal(null);
      await load();
    } catch (err) {
      toast(`Error: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  }

  async function handleEdit(data) {
    setProcessing(modal.user.id);
    try {
      await authedFetch(`/users/${modal.user.id}`, adminUser, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: data.displayName, roles: data.roles }) });
      toast('Usuario actualizado.');
      setModal(null);
      await load();
    } catch (err) {
      toast(`Error: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  }

  async function handleDelete() {
    setProcessing(modal.user.id);
    try {
      await authedFetch(`/users/${modal.user.id}`, adminUser, { method: 'DELETE' });
      toast('Usuario movido a la papelera.');
      setModal(null);
      await load();
    } catch (err) {
      toast(`Error: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  }

  async function handleRestore(u) {
    setProcessing(u.id);
    try {
      await authedFetch(`/users/${u.id}/restore`, adminUser, { method: 'POST' });
      toast('Usuario restaurado.');
      await load();
    } catch (err) {
      toast(`Error: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  }

  const thStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', padding: '11px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)' };
  const tdStyle = { padding: '13px 14px', borderBottom: '1px solid var(--border)', fontSize: '13.5px', verticalAlign: 'middle' };

  return (
    <PortalLayout
      title="Gestión de Usuarios"
      icon="👥"
      user={adminUser}
      signOutPortal={signOutPortal}
      currentPortal="usuarios"
    >
      <div className={`toast ${toastShow ? 'show' : ''}`}>{toastMsg}</div>

      <div className="portal-theme" style={{ maxWidth: '1200px' }}>
        {/* Role stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'rgba(124,131,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-users" style={{ color: 'var(--accent)', fontSize: '15px' }}></i>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{users.length}</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-soft)', fontWeight: 600 }}>Total Activos</p>
            </div>
          </div>
          {ALL_ROLES.map(r => (
            <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: r.color, flexShrink: 0 }}></div>
              <div>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: r.color }}>{roleStats[r.id] || 0}</p>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-soft)', fontWeight: 600 }}>{r.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: '20px' }}>
          <button className={`tab${activeTab === 'users' ? ' active' : ''}`} onClick={() => setActiveTab('users')}>
            <i className="fa-solid fa-users" style={{ marginRight: '6px' }}></i> Usuarios ({users.length})
          </button>
          <button className={`tab${activeTab === 'trash' ? ' active' : ''}`} onClick={() => setActiveTab('trash')}>
            <i className="fa-solid fa-trash" style={{ marginRight: '6px' }}></i> Papelera ({trashedUsers.length})
          </button>
        </div>

        {/* Users tab */}
        {activeTab === 'users' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o email..." style={{ flex: 1, minWidth: '180px', padding: '9px 14px', borderRadius: '10px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '13.5px' }} />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setFilterRole('all')} style={{ padding: '6px 12px', borderRadius: '20px', border: `1.5px solid ${filterRole === 'all' ? 'var(--accent)' : 'var(--border)'}`, background: filterRole === 'all' ? 'rgba(124,131,255,0.1)' : 'transparent', color: filterRole === 'all' ? 'var(--accent)' : 'var(--text-soft)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Todos</button>
                {ALL_ROLES.map(r => (
                  <button key={r.id} onClick={() => setFilterRole(r.id)} style={{ padding: '6px 12px', borderRadius: '20px', border: `1.5px solid ${filterRole === r.id ? r.color : 'var(--border)'}`, background: filterRole === r.id ? `${r.color}18` : 'transparent', color: filterRole === r.id ? r.color : 'var(--text-soft)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{r.label}</button>
                ))}
              </div>
              <button onClick={() => setModal({ type: 'create' })} style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>
                <i className="fa-solid fa-user-plus" style={{ marginRight: '6px' }}></i> Crear Usuario
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Roles</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i>Cargando...</td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>Sin resultados.</td></tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                              {(u.displayName || u.email || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <span style={{ fontWeight: 700, fontSize: '13.5px' }}>{u.displayName || '—'}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: '13px', color: 'var(--text-soft)' }}>{u.email}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                          {(u.roles || []).map(r => <RolePill key={r} roleId={r} />)}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '12px', color: 'var(--text-soft)' }}>
                          {u.providerData?.some(p => p.providerId === 'google.com') ? <><i className="fa-brands fa-google" style={{ marginRight: '4px' }}></i> Google</> : <><i className="fa-solid fa-envelope" style={{ marginRight: '4px' }}></i> Local</>}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button onClick={() => setModal({ type: 'edit', user: u })} disabled={processing === u.id} style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: 'rgba(124,131,255,0.12)', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button onClick={() => setModal({ type: 'delete', user: u })} disabled={processing === u.id || u.id === adminUser.uid} title={u.id === adminUser.uid ? 'No puedes eliminarte a ti mismo' : ''} style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.1)', color: u.id === adminUser.uid ? 'var(--muted)' : '#ef4444', cursor: u.id === adminUser.uid ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700 }}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trash tab */}
        {activeTab === 'trash' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-soft)' }}>
                <i className="fa-solid fa-circle-info" style={{ marginRight: '6px', color: '#f59e0b' }}></i>
                Los usuarios en papelera se eliminan permanentemente tras 30 días.
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Roles</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Restaurar</th>
                  </tr>
                </thead>
                <tbody>
                  {trashedUsers.length === 0 ? (
                    <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
                      <i className="fa-solid fa-trash-can" style={{ fontSize: '24px', marginBottom: '8px', display: 'block', opacity: 0.4 }}></i>La papelera está vacía.
                    </td></tr>
                  ) : trashedUsers.map(u => (
                    <tr key={u.id} style={{ opacity: 0.7 }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'var(--text-soft)', flexShrink: 0 }}>
                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', textDecoration: 'line-through', color: 'var(--text-soft)' }}>{u.displayName || '—'}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: '13px', color: 'var(--text-soft)' }}>{u.email}</td>
                      <td style={tdStyle}><div style={{ display: 'flex', flexWrap: 'wrap' }}>{(u.roles || []).map(r => <RolePill key={r} roleId={r} />)}</div></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button onClick={() => handleRestore(u)} disabled={processing === u.id} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'rgba(16,185,129,0.12)', color: '#10b981', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700 }}>
                          {processing === u.id ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-rotate-left" style={{ marginRight: '5px' }}></i>Restaurar</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'create' && <UserModal onConfirm={handleCreate} onCancel={() => setModal(null)} />}
      {modal?.type === 'edit' && <UserModal user={modal.user} onConfirm={handleEdit} onCancel={() => setModal(null)} />}
      {modal?.type === 'delete' && <ConfirmDeleteModal user={modal.user} onConfirm={handleDelete} onCancel={() => setModal(null)} />}
    </PortalLayout>
  );
}
