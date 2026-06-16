function money(currency, n) { return `${currency}${Number(n || 0).toFixed(2)}`; }

export default function ProductsTab({ products, currency }) {
  return (
    <div className="panel">
      <h2>Catálogo de Productos ({products.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Stock</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={3} className="muted-note">No hay productos en el catálogo.</td></tr>
            ) : products.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td><span className="status-pill status-delivered">Stock: {p.stock || 0}</span></td>
                <td><strong>{money(currency, p.price)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
