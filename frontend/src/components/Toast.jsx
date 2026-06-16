import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';

export default function Toast() {
  const { toastMsg, toastShow } = useCart();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (toastShow) {
      setHidden(false);
      return undefined;
    }
    const t = setTimeout(() => setHidden(true), 300);
    return () => clearTimeout(t);
  }, [toastShow]);

  return (
    <div className={`toast${toastShow ? ' show' : ''}`} role="status" aria-live="polite" hidden={hidden}>
      {toastMsg}
    </div>
  );
}
