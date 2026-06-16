import { useEffect, useState } from 'react';

// Port fiel de la lógica de roles ya usada en assets/js/catalog.js / producto.js.
function readRoles() {
  const isLoggedIn = localStorage.getItem('gyro_admin_logged_in') === 'true';
  let roles = [];
  try { roles = JSON.parse(localStorage.getItem('gyro_user_roles') || '[]'); } catch { roles = []; }
  const isAdmin = isLoggedIn && (roles.includes('admin') || roles.includes('global_admin'));
  const isSeller = isLoggedIn && !isAdmin && roles.some((r) => ['seller', 'cashier'].includes(r));
  const isLogisticsOnly = isLoggedIn && !isAdmin && !isSeller
    && (roles.includes('logistics_admin') || roles.includes('logistics_customer'));
  return { isLoggedIn, roles, isAdmin, isSeller, isLogisticsOnly };
}

export function useUserRoles() {
  const [state, setState] = useState(readRoles);

  useEffect(() => {
    const onStorage = () => setState(readRoles());
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onStorage);
    };
  }, []);

  return state;
}
