// Fetch wrapper compartido por los portales internos en React: adjunta el
// token de Firebase del usuario autenticado (objeto devuelto por usePortalAuth).
export async function authedFetch(path, user, options = {}) {
  const token = await user.getIdToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
