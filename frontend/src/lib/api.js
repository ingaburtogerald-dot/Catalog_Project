const API = '/api';

async function fetchJSON(path, options) {
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const fetchConfig = () => fetchJSON('/config');
export const fetchProducts = () => fetchJSON('/products');
export const fetchProduct = (id) => fetchJSON(`/products/${encodeURIComponent(id)}`);

export const createOrder = (payload) => fetchJSON('/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const reorderProducts = (items, token) => fetchJSON('/products/reorder', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ items }),
});
