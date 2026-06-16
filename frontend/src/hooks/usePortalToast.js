import { useCallback, useRef, useState } from 'react';

// Toast minimalista para portales internos en React (no depende de CartContext,
// a diferencia de frontend/src/components/Toast.jsx que es solo para el catálogo).
export function usePortalToast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);

  const toast = useCallback((message, duration = 3000) => {
    if (!message) return;
    setMsg(message);
    setShow(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), duration);
  }, []);

  return { toast, toastMsg: msg, toastShow: show };
}
