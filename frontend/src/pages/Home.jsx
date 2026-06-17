import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Hero from '../components/Hero';
import FeaturedStrip from '../components/FeaturedStrip';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useUserRoles } from '../hooks/useUserRoles';
import { fetchConfig, reorderProducts } from '../lib/api';
import { getFirebaseAuth } from '../lib/firebaseClient';
import CatalogDrawer from '../portals/admin/components/CatalogDrawer';

export default function Home() {
  const { setConfig } = useCart();
  const { isAdmin } = useUserRoles();
  const [searchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [topSellers, setTopSellers] = useState([]);
  const [unconfigured, setUnconfigured] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'top-sellers', 'promos', 'unconfigured', 'out-of-stock'
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshCatalog = () => setRefreshKey(k => k + 1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const canEdit = isAdmin && activeTab === 'all' && activeCategory === 'all' && !searchTerm.trim();

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = catalog.findIndex(i => i.id === active.id);
      const newIndex = catalog.findIndex(i => i.id === over.id);
      const newArray = arrayMove(catalog, oldIndex, newIndex);
      setCatalog(newArray);
      
      setSavingOrder(true);
      try {
        const payload = newArray.map((item, idx) => ({ id: item.id, order: idx }));
        let token = null;
        try {
          const auth = await getFirebaseAuth();
          if (auth.currentUser) token = await auth.currentUser.getIdToken();
        } catch(e) {}
        
        await reorderProducts(payload, token);
      } catch (err) {
        alert('Error al reordenar: ' + err.message);
      } finally {
        setSavingOrder(false);
      }
    }
  }

  // Cargar catálogo principal (all=true si es admin para ver stock 0)
  useEffect(() => {
    document.title = 'Gyro Store — Audífonos KZ, in-ear y accesorios en Managua';
    (async () => {
      try {
        const catalogUrl = isAdmin ? '/api/catalog?all=true' : '/api/catalog';
        const [cfg, catalogData, topSellersData] = await Promise.all([
          fetchConfig(), 
          fetch(catalogUrl).then(res => res.json()),
          fetch('/api/catalog/top-sellers').then(res => res.json())
        ]);
        setConfig(cfg);
        setCategories(cfg.categories || []);
        setCatalog(Array.isArray(catalogData) ? catalogData : []);
        setTopSellers(Array.isArray(topSellersData) ? topSellersData : []);
      } catch (err) {
        setLoadError(err.message);
      }
    })();
  }, [setConfig, isAdmin, refreshKey]);

  // Cargar variantes no configuradas de inventario
  useEffect(() => {
    if (isAdmin && isEditMode) {
      fetch('/api/catalog/unconfigured')
        .then(res => res.json())
        .then(data => setUnconfigured(Array.isArray(data) ? data : []))
        .catch(console.error);
    }
  }, [isAdmin, isEditMode]);

  const visibleCatalog = useMemo(() => {
    let source = catalog;
    
    // Si no está en modo edición, ocultamos agotados del catálogo público
    if (!isEditMode) {
      source = source.filter(p => p.stock > 0);
    }

    if (activeTab === 'top-sellers') {
      source = topSellers;
    } else if (activeTab === 'promos') {
      source = source.filter(c => c.isPromo);
    } else if (activeTab === 'out-of-stock') {
      source = catalog.filter(c => c.stock === 0);
    }
    
    const term = searchTerm.trim().toLowerCase();
    return source.filter((p) =>
      (activeCategory === 'all' || activeTab !== 'all' || p.category === activeCategory) &&
      (!term || `${p.name || ''} ${p.desc || ''}`.toLowerCase().includes(term))
    );
  }, [catalog, topSellers, activeTab, activeCategory, searchTerm, isEditMode]);

  const sectionTitle = useMemo(() => {
    if (searchTerm.trim()) return `Resultados para "${searchTerm.trim()}"`;
    if (activeTab === 'top-sellers') return '🔥 Los Más Vendidos';
    if (activeTab === 'promos') return '⭐ Promociones Disponibles';
    const cat = categories.find((c) => c.id === activeCategory);
    return cat ? `${cat.icon} ${cat.name}` : 'Todos los productos en Gyro Store';
  }, [searchTerm, activeTab, activeCategory, categories]);

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

      <Hero searchTerm={searchTerm} onSearch={setSearchTerm} productCount={catalog.length} />

      <FeaturedStrip products={catalog} categories={categories} />

      <main id="catalogo" className="container">
        <section className="catalog-section" aria-labelledby="catalog-heading">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <h2 id="catalog-heading" className="seccion-titulo" style={{ margin: 0 }}>
              <i className="fa-solid fa-fire"></i> <span>{sectionTitle}</span>
            </h2>
            {isAdmin && (
              <button 
                className={`btn ${isEditMode ? 'btn-solid' : 'btn-ghost'}`} 
                style={{ fontSize: '13px', padding: '6px 16px', borderRadius: '20px', marginLeft: 'auto' }}
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  setActiveTab('all');
                }}
              >
                {isEditMode ? '✅ Salir de Edición' : '✏️ Editar Vista del Catálogo'}
              </button>
            )}
            {savingOrder && <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>Guardando orden...</span>}
          </div>

          <div className="toolbar" style={{ borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
            <div className="tabs" role="group" aria-label="Filtrar por tipo de catálogo" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                📦 Todo el Catálogo
              </button>
              <button
                className={`tab ${activeTab === 'top-sellers' ? 'active' : ''}`}
                onClick={() => setActiveTab('top-sellers')}
              >
                🔥 Más Vendidos
              </button>
              <button
                className={`tab ${activeTab === 'promos' ? 'active' : ''}`}
                onClick={() => setActiveTab('promos')}
              >
                ⭐ Promociones
              </button>
              {isEditMode && (
                <>
                  <button
                    className={`tab ${activeTab === 'unconfigured' ? 'active' : ''}`}
                    onClick={() => setActiveTab('unconfigured')}
                    style={{ borderColor: 'var(--accent-soft)', color: activeTab === 'unconfigured' ? '#fff' : 'var(--accent-soft)' }}
                  >
                    🛠️ Ítems sin configurar ({unconfigured.length})
                  </button>
                  <button
                    className={`tab ${activeTab === 'out-of-stock' ? 'active' : ''}`}
                    onClick={() => setActiveTab('out-of-stock')}
                    style={{ borderColor: '#f59e0b', color: activeTab === 'out-of-stock' ? '#fff' : '#f59e0b' }}
                  >
                    ⚠️ Agotados ({catalog.filter(c => c.stock === 0).length})
                  </button>
                </>
              )}
            </div>
            
            {activeTab === 'all' && (
              <div className="filters" role="group" aria-label="Filtrar por categoría" style={{ marginTop: '16px' }}>
                {[{ id: 'all', name: 'Todas las categorías', icon: '🛍️' }, ...categories].map((c) => (
                  <button
                    key={c.id}
                    className={`chip${c.id === activeCategory ? ' active' : ''}`}
                    onClick={() => setActiveCategory(c.id)}
                  >
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadError ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true"><i className="fa-solid fa-triangle-exclamation"></i></span>
              <p>No se pudo cargar el catálogo: {loadError}</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={isEditMode && canEdit ? handleDragEnd : undefined}>
              <div className={`catalog-grid`} aria-live="polite">
                {isEditMode && activeTab === 'all' && (
                  <div 
                    className="card card-glass" 
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', cursor: 'pointer', border: '2px dashed var(--accent)', background: 'rgba(124,131,255,0.05)', boxShadow: 'none' }}
                    onClick={() => { setEditProductId(null); setPrefillData(null); setIsDrawerOpen(true); }}
                  >
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
                      <i className="fa-solid fa-plus"></i>
                    </div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--accent)', fontSize: '18px' }}>Agregar Producto</p>
                    <p style={{ margin: '8px 0 0 0', color: 'var(--text-soft)', fontSize: '13px', textAlign: 'center', padding: '0 20px' }}>Haz clic aquí para añadir un nuevo ítem al catálogo</p>
                  </div>
                )}
                
                {activeTab === 'unconfigured' ? (
                  unconfigured.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      <span className="empty-icon"><i className="fa-regular fa-face-smile"></i></span>
                      <p>¡Excelente! Todas las variantes del inventario han sido catalogadas.</p>
                    </div>
                  ) : (
                    unconfigured.map((p) => (
                      <article className="card" key={p.id} style={{ opacity: 0.9 }}>
                        <div className="card-media" style={{ background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
                          <span className="card-tag" style={{ background: 'var(--accent-soft)' }}>Borrador</span>
                          <span style={{ fontSize: '64px' }}>📦</span>
                        </div>
                        <div className="card-body">
                          <h3 className="card-title">{p.name}</h3>
                          <p className="card-desc" style={{ fontSize: '12px', color: 'var(--text-soft)', minHeight: '60px' }}>
                            {p.desc || 'Variante de inventario física. Aún no está configurada en el catálogo público comercial.'}
                          </p>
                          <p className="card-price" style={{ color: 'var(--accent-soft)' }}>Precio Sug. C${p.price}</p>
                          <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                            <button
                              className="btn btn--add"
                              style={{ width: '100%', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              onClick={() => {
                                setEditProductId(null);
                                setPrefillData({
                                  name: p.name || '',
                                  category: p.category || '',
                                  variants: p.variants || [p.id]
                                });
                                setIsDrawerOpen(true);
                              }}
                            >
                              ⚙️ Configurar Publicación
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )
                ) : (
                  <SortableContext items={Array.isArray(visibleCatalog) ? visibleCatalog.map(p => p.id) : []} strategy={rectSortingStrategy}>
                    {Array.isArray(visibleCatalog) && visibleCatalog.map((p) => (
                      <ProductCard 
                        key={p.id} 
                        product={p} 
                        categories={categories} 
                        isEditMode={isEditMode} 
                        canEdit={canEdit}
                        onEdit={(id) => { setEditProductId(id); setPrefillData(null); setIsDrawerOpen(true); }}
                      />
                    ))}
                  </SortableContext>
                )}
              </div>
            </DndContext>
          )}

          {!loadError && activeTab !== 'unconfigured' && visibleCatalog.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true"><i className="fa-regular fa-folder-open"></i></span>
              <p>Próximamente más productos disponibles en esta sección.</p>
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>© <span>{new Date().getFullYear()}</span> Gyro Store · Hecho por <strong>Ing. Gerald Aburto</strong></p>
        <p>Contacto: <a href="mailto:ingaburtogerald@gmail.com">ingaburtogerald@gmail.com</a></p>
      </footer>

      {isAdmin && (
        <CatalogDrawer
          isOpen={isDrawerOpen}
          onClose={() => { setIsDrawerOpen(false); setPrefillData(null); }}
          onSaved={refreshCatalog}
          editProductId={editProductId}
          prefillData={prefillData}
        />
      )}
    </>
  );
}
