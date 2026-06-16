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
  const [loadError, setLoadError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'top-sellers', 'promos'
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editProductId, setEditProductId] = useState(null);

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

  useEffect(() => {
    document.title = 'Gyro Store — Audífonos KZ, in-ear y accesorios en Managua';
    (async () => {
      try {
        const [cfg, catalogData, topSellersData] = await Promise.all([
          fetchConfig(), 
          fetch('/api/catalog').then(res => res.json()),
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
  }, [setConfig]);

  const visibleCatalog = useMemo(() => {
    let source = catalog;
    if (activeTab === 'top-sellers') {
      source = topSellers;
    } else if (activeTab === 'promos') {
      source = catalog.filter(c => c.isPromo);
    }
    
    const term = searchTerm.trim().toLowerCase();
    return source.filter((p) =>
      (activeCategory === 'all' || activeTab !== 'all' || p.category === activeCategory) &&
      (!term || `${p.name || ''} ${p.desc || ''}`.toLowerCase().includes(term))
    );
  }, [catalog, topSellers, activeTab, activeCategory, searchTerm]);

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
                onClick={() => setIsEditMode(!isEditMode)}
              >
                {isEditMode ? '✅ Salir de Edición' : '✏️ Editar Vista del Catálogo'}
              </button>
            )}
            {savingOrder && <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>Guardando orden...</span>}
          </div>

          <div className="toolbar" style={{ borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
            <div className="tabs" role="group" aria-label="Filtrar por tipo de catálogo" style={{ display: 'flex', gap: '8px' }}>
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
                {isEditMode && (
                  <div 
                    className="card card-glass" 
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', cursor: 'pointer', border: '2px dashed var(--accent)', background: 'rgba(124,131,255,0.05)', boxShadow: 'none' }}
                    onClick={() => { setEditProductId(null); setIsDrawerOpen(true); }}
                  >
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
                      <i className="fa-solid fa-plus"></i>
                    </div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--accent)', fontSize: '18px' }}>Agregar Producto</p>
                    <p style={{ margin: '8px 0 0 0', color: 'var(--text-soft)', fontSize: '13px', textAlign: 'center', padding: '0 20px' }}>Haz clic aquí para añadir un nuevo ítem al catálogo</p>
                  </div>
                )}
                <SortableContext items={Array.isArray(visibleCatalog) ? visibleCatalog.map(p => p.id) : []} strategy={rectSortingStrategy}>
                  {Array.isArray(visibleCatalog) && visibleCatalog.map((p) => (
                    <ProductCard 
                      key={p.id} 
                      product={{ ...p, stock: p.variants?.length > 0 ? 99 : 0 }} 
                      categories={categories} 
                      isEditMode={isEditMode} 
                      canEdit={canEdit}
                      onEdit={(id) => { setEditProductId(id); setIsDrawerOpen(true); }}
                    />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          )}

          {!loadError && visibleCatalog.length === 0 && (
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
          onClose={() => setIsDrawerOpen(false)} 
          editProductId={editProductId} 
        />
      )}
    </>
  );
}
