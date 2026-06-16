import { useCallback, useEffect, useRef, useState } from 'react';
import { authedFetch } from '../../lib/portalApi';

const POLL_MS = 45 * 1000;
const LAST_CHECK_KEY = 'gyro_seller_last_notif_check';
const SEEN_KEY = 'gyro_seller_seen_notifications';
const MAX_SEEN = 50;

function getSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}

function saveSeen(set) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-MAX_SEEN)));
}

// Polling liviano de aprobaciones/rechazos sin WebSockets. Mantiene en localStorage
// el timestamp del último check y los IDs ya notificados para no repetir avisos
// si el usuario refresca la página.
export function useApprovalNotifications(user, onNewNotification) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenRef = useRef(getSeen());

  const poll = useCallback(async () => {
    if (!user) return;
    const since = localStorage.getItem(LAST_CHECK_KEY) || new Date(0).toISOString();
    try {
      const results = await authedFetch(`/orders/notifications?since=${encodeURIComponent(since)}`, user);
      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());

      const fresh = results.filter((n) => !seenRef.current.has(n.id + n.status));
      if (fresh.length) {
        fresh.forEach((n) => seenRef.current.add(n.id + n.status));
        saveSeen(seenRef.current);
        setItems((prev) => [...fresh, ...prev].slice(0, 20));
        setUnreadCount((c) => c + fresh.length);
        fresh.forEach((n) => onNewNotification?.(n));
      }
    } catch {
      // Silencioso — el polling reintenta en el próximo ciclo.
    }
  }, [user, onNewNotification]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  function markAllRead() {
    setUnreadCount(0);
  }

  return { items, unreadCount, markAllRead };
}
