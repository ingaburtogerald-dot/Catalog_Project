import { useState, useEffect, useCallback, useRef } from 'react';
import { authedFetch } from '../lib/portalApi';

const POLL_MS = 60 * 1000;

function isAdmin(user) {
  const roles = user?.roles || [];
  return roles.includes('admin') || roles.includes('global_admin');
}

const money = (n) => `C$${(Number(n) || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Agrega las tareas pendientes del admin desde dos fuentes:
//   - Inventario: ítems reportados como recibidos en Nicaragua (status 'pending').
//   - Ventas: órdenes de vendedores pendientes de aprobación ('pending_approval').
// Resuelve el email del usuario a su display name (Gestión de Usuarios).
export function useAdminNotifications(user) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const nameByEmail = useRef({});
  const timer = useRef(null);

  // Mapa email → display name (se carga una vez; cambia rara vez).
  const loadUsers = useCallback(async () => {
    if (!isAdmin(user)) return;
    try {
      const users = await authedFetch('/users', user);
      const map = {};
      (Array.isArray(users) ? users : []).forEach(u => {
        if (u.email) map[u.email.toLowerCase()] = u.displayName || u.email;
      });
      nameByEmail.current = map;
    } catch { /* si falla, se usa el email como fallback */ }
  }, [user]);

  const load = useCallback(async () => {
    if (!isAdmin(user)) { setNotifications([]); setLoading(false); return; }
    const nameOf = (email, fallback) => (email && nameByEmail.current[email.toLowerCase()]) || fallback || email || 'Un usuario';
    try {
      const [inv, orders] = await Promise.all([
        authedFetch('/inventory', user).catch(() => []),
        authedFetch('/orders', user).catch(() => []),
      ]);

      const invNotifs = (Array.isArray(inv) ? inv : [])
        .filter(i => i.status === 'pending')
        .map(i => ({
          id: `inv-${i.id}`,
          type: 'inventory',
          icon: 'fa-box',
          color: '#f59e0b',
          text: `${nameOf(i.reportedBy || i.createdBy)} reportó la llegada del ítem ${i.code} - ${i.name}`,
          href: '/inventario?view=pending',
        }));

      const saleNotifs = (Array.isArray(orders) ? orders : [])
        .filter(o => o.status === 'pending_approval')
        .map(o => ({
          id: `sale-${o.id}`,
          type: 'sale',
          icon: 'fa-cart-shopping',
          color: '#0ea5e9',
          text: `${nameOf(o.sellerEmail, o.sellerName)} registró una nueva venta por ${money(o.total)}`,
          href: '/vendedor.html?view=approvals',
        }));

      setNotifications([...invNotifs, ...saleNotifs]);
    } catch {
      /* silencioso: el badge simplemente no se actualiza */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUsers().then(load);
    timer.current = setInterval(load, POLL_MS);
    return () => clearInterval(timer.current);
  }, [loadUsers, load]);

  return { notifications, count: notifications.length, loading, reload: load };
}
