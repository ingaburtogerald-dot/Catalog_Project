import { useUserRoles } from '../hooks/useUserRoles';
import { getFirebaseAuth, signOut } from '../auth/services/firebaseAuth';
import GlobalNav from './GlobalNav';

function clearGyroSession() {
  ['gyro_admin_logged_in', 'gyro_admin_dev_mode', 'gyro_user_name',
   'gyro_user_photo', 'gyro_user_role', 'gyro_user_roles', 'gyro_last_activity']
    .forEach(k => localStorage.removeItem(k));
  sessionStorage.removeItem('gyro_welcome_shown');
}

async function handleLogout() {
  clearGyroSession();
  try {
    const auth = await getFirebaseAuth();
    await signOut(auth).catch(() => {});
  } catch { /* noop */ }
  window.location.href = '/';
}

export default function Sidebar({ open, onClose, categories, activeCategory, onSelectCategory }) {
  const { isLoggedIn, roles } = useUserRoles();

  const allCategories = [{ id: 'all', name: 'Todo el catálogo', icon: '🛍️' }, ...categories];

  return (
    <>
      <div className="overlay" hidden={!open} onClick={onClose}></div>
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Menú de categorías" aria-hidden={!open}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img className="logo-compacto" src="/assets/img/Gyro_Store_logo.jpeg" alt="Logo de Gyro Store" />
            <span className="sidebar-title">GYRO STORE</span>
          </div>
          <button className="icon-btn" aria-label="Cerrar menú" onClick={onClose}>✕</button>
        </div>

        <nav className="sidebar-nav" aria-label="Categorías de productos">
          <p className="sidebar-section-label">Categorías</p>
          <ul>
            {allCategories.map((c) => (
              <li key={c.id}>
                <a
                  href={`?cat=${encodeURIComponent(c.id)}`}
                  className={c.id === activeCategory ? 'active' : ''}
                  onClick={(e) => { e.preventDefault(); onSelectCategory(c.id); onClose(); }}
                >
                  {c.icon} {c.name}
                </a>
              </li>
            ))}

            {isLoggedIn ? (
              <GlobalNav roles={roles} mode="sidebar" onLogout={handleLogout} />
            ) : (
              <li>
                <a href="/login">
                  <i className="fa-solid fa-lock"></i> Iniciar Sesión
                </a>
              </li>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-location">📍 Managua, conchita palacios 2c al lago, 1c arriba</p>
        </div>
      </aside>
    </>
  );
}
