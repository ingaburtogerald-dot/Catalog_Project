import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sortable from 'sortablejs';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Hero from '../components/Hero';
import FeaturedStrip from '../components/FeaturedStrip';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useUserRoles } from '../hooks/useUserRoles';
import { fetchConfig, fetchProducts, reorderProducts } from '../lib/api';

export default function Home() {
  const { setConfig } = useCart();
  const { isAdmin } = useUserRoles();
  const [searchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const gridRef = useRef(null);
  const sortableRef = useRef(null);

  useEffect(() => {
    document.title = 'Gyro Store — Audífonos KZ, in-ear y accesorios en Managua';
    (async () => {
      try {
        const [cfg, prods] = await Promise.all([fetchConfig(), fetchProducts()]);
        setConfig(cfg);
        setCategories(cfg.categories || []);
        setProducts(prods);
      } catch (err) {
        setLoadError(err.message);
      }
    })();
  }, [setConfig]);

  const visibleProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter((p) =>
      (activeCategory === 'all' || p.category === activeCategory) &&
      (!term || `${p.name} ${p.desc}`.toLowerCase().includes(term)));
  }, [products, activeCategory, searchTerm]);

  const sectionTitle = useMemo(() => {
    if (searchTerm.trim()) return `Resultados para "${searchTerm.trim()}"`;
    const cat = categories.find((c) => c.id === activeCategory);
    return cat ? `${cat.icon} ${cat.name}` : 'Todos los productos en Gyro Store';
  }, [searchTerm, activeCategory, categories]);

  // ── Modo edición admin (drag-and-drop para reordenar) ──────────────────────
  useEffect(() => {
    if (!isEditMode || !gridRef.current) return undefined;
    sortableRef.current = new Sortable(gridRef.current, { animation: 150, ghostClass: 'sortable-ghost' });
    return () => {
      sortableRef.current?.destroy();
      sortableRef.current = null;
    };
  }, [isEditMode, visibleProducts.length]);

  async function saveOrder() {
    if (!sortableRef.current) return;
    const order = sortableRef.current.toArray();
    setSaving(true);
    try {
      const token = localStorage.getItem('gyro_admin_dev_mode') === 'true' ? 'dev-token' : '';
      await reorderProducts(order.map((id, index) => ({ id, order: index })), token);
      setProducts((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        const reordered = order.map((id) => byId.get(id)).filter(Boolean);
        const rest = prev.filter((p) => !order.includes(p.id));
        return [...reordered, ...rest];
      });
      setEditMode(false);
    } catch (err) {
      alert('Error al guardar el nuevo orden: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#catalogo">Saltar al catálogo</a>

      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={(id) => { setActiveCategory(id); setSearchTerm(''); }}
      />

      <Header onOpenMenu={() => setMenuOpen(true)} />

      <Hero searchTerm={searchTerm} onSearch={setSearchTerm} productCount={products.length} />

      <FeaturedStrip products={products} categories={categories} />

      <main id="catalogo" className="container">
        <section className="catalog-section" aria-labelledby="catalog-heading">
          <h2 id="catalog-heading" className="seccion-titulo">
            <i className="fa-solid fa-fire"></i> <span>{sectionTitle}</span>
          </h2>

          <div className="toolbar">
            <div className="filters" role="group" aria-label="Filtrar por categoría">
              {[{ id: 'all', name: 'Todo el catálogo', icon: '🛍️' }, ...categories].map((c) => (
                <button
                  key={c.id}
                  className={`chip${c.id === activeCategory ? ' active' : ''}`}
                  onClick={() => setActiveCategory(c.id)}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          {loadError ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true"><i className="fa-solid fa-triangle-exclamation"></i></span>
              <p>No se pudo cargar el catálogo: {loadError}</p>
            </div>
          ) : (
            <div className={`catalog-grid${isEditMode ? ' edit-mode' : ''}`} ref={gridRef} aria-live="polite">
              {visibleProducts.map((p, i) => (
                <div key={p.id} data-id={p.id} style={isEditMode ? { pointerEvents: 'none', cursor: 'grab' } : undefined}>
                  <ProductCard product={p} categories={categories} index={i} />
                </div>
              ))}
            </div>
          )}

          {!loadError && visibleProducts.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true"><i className="fa-regular fa-folder-open"></i></span>
              <p>Próximamente más productos en esta categoría.</p>
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>© <span>{new Date().getFullYear()}</span> Gyro Store · Hecho por <strong>Ing. Gerald Aburto</strong></p>
        <p>Contacto: <a href="mailto:ingaburtogerald@gmail.com">ingaburtogerald@gmail.com</a></p>
      </footer>

      {isAdmin && !menuOpen && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 1000, display: 'flex', gap: 10 }}>
          <button
            className="btn btn--checkout"
            style={{ background: isEditMode ? 'var(--text-soft)' : 'var(--accent)', color: '#fff', borderRadius: 30, boxShadow: '0 4px 15px rgba(0,0,0,.3)' }}
            onClick={() => setEditMode((v) => !v)}
          >
            <i className={`fa-solid ${isEditMode ? 'fa-times' : 'fa-pen'}`}></i> {isEditMode ? 'Cancelar Edición' : 'Editar Catálogo'}
          </button>
          {isEditMode && (
            <button
              className="btn btn--checkout"
              style={{ background: '#10b981', color: '#fff', borderRadius: 30, boxShadow: '0 4px 15px rgba(0,0,0,.3)' }}
              onClick={saveOrder}
              disabled={saving}
            >
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> {saving ? 'Guardando...' : 'Guardar Orden'}
            </button>
          )}
        </div>
      )}
    </>
  );
}
