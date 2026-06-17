import { useCallback, useEffect, useState } from 'react';
import { authedFetch } from '../../lib/portalApi';

// GET /api/orders ya filtra server-side a las órdenes propias del vendedor.
// Sirve como fuente única tanto para el tab de Pedidos como para Comisiones/Métricas.
export function useSellerOrders(user) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedFetch('/orders', user);
      setOrders(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, status, rejectionReason) {
    await authedFetch(`/orders/${id}`, user, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(rejectionReason ? { rejectionReason } : {}) }),
    });
    await load();
  }

  return { orders, loading, error, reload: load, updateStatus };
}
