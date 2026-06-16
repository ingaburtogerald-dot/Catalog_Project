import { useState, useEffect } from 'react';

export default function PromoManager({ user }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog');
      const data = await res.json();
      setCatalog(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const togglePromo = async (id, currentStatus) => {
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/catalog/${id}/promo`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ isPromo: !currentStatus })
      });
      
      if (res.ok) {
        setCatalog(catalog.map(c => c.id === id ? { ...c, isPromo: !currentStatus } : c));
      }
    } catch (err) {
      alert('Error cambiando promoción: ' + err.message);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>;

  return (
    <div className="panel card-glass">
      <h2>Gestión de Promociones</h2>
      <p className="muted-note" style={{ marginBottom: '16px' }}>
        Marca los productos que quieres que aparezcan en la pestaña "Promociones Disponibles" del catálogo público.
      </p>

      {catalog.length === 0 ? (
        <p>No hay productos en el catálogo público todavía.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Producto General</th>
                <th>Categoría</th>
                <th>Precio Base</th>
                <th>¿Es Promoción?</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {c.images && c.images.length > 0 && (
                        <img src={c.images[0]} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                      )}
                      <strong>{c.name}</strong>
                    </div>
                  </td>
                  <td>{c.category}</td>
                  <td>C${c.price}</td>
                  <td>
                    {c.isPromo 
                      ? <span className="status-pill status-delivered">Activa</span>
                      : <span className="status-pill status-cancelled">Inactiva</span>
                    }
                  </td>
                  <td>
                    <button 
                      className={`btn-ghost ${c.isPromo ? '' : 'active'}`}
                      onClick={() => togglePromo(c.id, c.isPromo)}
                      style={{ padding: '6px 12px', fontSize: '12px', borderColor: c.isPromo ? 'var(--danger)' : 'var(--accent)' }}
                    >
                      {c.isPromo ? 'Quitar Promoción' : 'Destacar Promoción'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
