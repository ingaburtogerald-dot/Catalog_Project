import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProducts, fetchConfig } from '../../../lib/api';
import { getFirebaseAuth, onAuthStateChanged } from '../../../lib/firebaseClient';

export default function CatalogDrawer({ isOpen, onClose, onSaved, editProductId = null, prefillData = null }) {
  const [categories, setCategories] = useState([]);
  const [inventory, setInventory] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    desc: '',
    variants: [],
    isPromo: false
  });
  
  const [existingImages, setExistingImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  const fileInputRef = useRef(null);

  // Combinación de imágenes existentes y nuevas previsualizaciones
  const previews = [...existingImages, ...newPreviews];

  useEffect(() => {
    if (isOpen) {
      fetchConfig().then(cfg => {
        if (cfg.categories) setCategories(cfg.categories);
      }).catch(console.error);
      
      // Cargar todos los ítems de inventario (incluyendo agotados) para permitir vinculación completa
      fetch('/api/products?all=true')
        .then(res => res.json())
        .then(res => {
          setInventory(res);
        })
        .catch(console.error);
      
      if (!editProductId) {
        if (prefillData) {
          setFormData({
            name: prefillData.name || '',
            category: prefillData.category || '',
            desc: '',
            variants: prefillData.variants || [],
            isPromo: false
          });
        } else {
          setFormData({ name: '', category: '', desc: '', variants: [], isPromo: false });
        }
        setExistingImages([]);
        setFiles([]);
        setNewPreviews([]);
        setMsg({ type: '', text: '' });
      } else {
        setLoading(true);
        fetch(`/api/catalog/${editProductId}`)
          .then(res => res.json())
          .then(data => {
            setFormData({
              name: data.name || '',
              category: data.category || '',
              desc: data.desc || '',
              variants: data.variants ? data.variants.map(v => v.id) : [],
              isPromo: !!data.isPromo
            });
            setExistingImages(data.images || []);
            setFiles([]);
            setNewPreviews([]);
            setMsg({ type: '', text: '' });
          })
          .catch(err => {
            setMsg({ type: 'error', text: 'Error al cargar detalles: ' + err.message });
          })
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, editProductId]);

  // AUTO-MATCH LÓGICA (useMemo) - Buscador inteligente por palabras
  const suggestedVariants = useMemo(() => {
    const nameStr = (formData.name || '').trim().toLowerCase();
    if (nameStr.length > 2) {
      return inventory
        .filter(p => {
          const itemName = (p.name || '').toLowerCase();
          return itemName.includes(nameStr) && !formData.variants.includes(p.id);
        })
        .slice(0, 12);
    }
    return [];
  }, [formData.name, inventory, formData.variants]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
    
    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setNewPreviews(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };
  
  const removeFile = (index) => {
    if (index < existingImages.length) {
      setExistingImages(prev => prev.filter((_, i) => i !== index));
    } else {
      const fileIndex = index - existingImages.length;
      setFiles(prev => prev.filter((_, i) => i !== fileIndex));
      setNewPreviews(prev => prev.filter((_, i) => i !== fileIndex));
    }
  };

  const toggleVariantLink = (item) => {
    setFormData(prev => {
      const isLinked = prev.variants.includes(item.id);
      if (isLinked) {
        return { ...prev, variants: prev.variants.filter(v => v !== item.id) };
      } else {
        return { ...prev, variants: [...prev.variants, item.id] };
      }
    });
  };

  const addAllSuggestions = () => {
    const newVariants = suggestedVariants.map(v => v.id);
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, ...newVariants]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.category) {
      setMsg({ type: 'error', text: 'El nombre y la categoría son requeridos.' });
      return;
    }
    
    setLoading(true);
    setMsg({ type: 'info', text: 'Guardando datos...' });

    try {
      const auth = await getFirebaseAuth();
      let user = auth.currentUser;
      
      if (!user) {
        // Esperar a que Firebase inicialice el estado de autenticación (IndexedDB)
        await new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (u) => {
            user = u;
            unsubscribe();
            resolve();
          });
          setTimeout(() => {
            unsubscribe();
            resolve();
          }, 1500); // Timeout de 1.5s
        });
      }

      if (!user) {
        throw new Error('No estás autenticado. Por favor, inicia sesión en el Portal de Administración primero.');
      }
      const token = await user.getIdToken();
      let uploadedUrls = [];
      
      if (files.length > 0) {
        setMsg({ type: 'info', text: 'Subiendo imágenes...' });
        const fd = new FormData();
        files.forEach(f => fd.append('images', f));
        
        const uploadRes = await fetch('/api/catalog/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Error subiendo fotos');
        uploadedUrls = uploadData.urls;
      }
      
      setMsg({ type: 'info', text: 'Guardando producto en el catálogo...' });
      
      const payload = {
        ...formData,
        images: [...existingImages, ...uploadedUrls]
      };

      const endpoint = editProductId ? `/api/catalog/${editProductId}` : '/api/catalog';
      const method = editProductId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando en catálogo');

      setMsg({ type: 'success', text: `¡Producto ${editProductId ? 'actualizado' : 'publicado'} con éxito!` });
      setTimeout(() => {
        onClose();
        onSaved?.();
      }, 1500);

    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* BACKDROP */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', zIndex: 999 }}
          />

          {/* DRAWER */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '600px', height: '100vh', backgroundColor: 'var(--bg-color)', borderLeft: '1px solid var(--border)', zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            {/* HEADER */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--accent)' }}></i> 
                {editProductId ? 'Editar Producto' : 'Crear Producto Público'}
              </h2>
              <button onClick={onClose} className="btn-ghost" style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* BODY */}
            <div style={{ padding: '24px', flex: 1 }}>
              {msg.text && (
                <div style={{ padding: '14px 20px', borderRadius: '8px', marginBottom: '24px', background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: msg.type === 'error' ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                  <i className={`fa-solid ${msg.type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}></i>
                  {msg.text}
                </div>
              )}
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Info Principal */}
                <div className="grid-form" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
                  <label style={{ margin: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '6px', display: 'block' }}>Nombre del Producto</span>
                    <input 
                      type="text" 
                      placeholder="Ej. KZ Castor Harman" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      required
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)' }}
                    />
                  </label>
                  
                  <label style={{ margin: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '6px', display: 'block' }}>Categoría</span>
                    <select 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})} 
                      required
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)' }}
                    >
                      <option value="">Seleccione una categoría...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)', margin: 0 }}>
                  Descripción
                  <textarea 
                    placeholder="Descripción detallada..." 
                    value={formData.desc}
                    onChange={e => setFormData({...formData, desc: e.target.value})}
                    style={{ minHeight: '80px', padding: '12px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text)', resize: 'vertical' }}
                  />
                </label>

                {/* Vinculación Inteligente (Auto-Match) */}
                <div style={{ border: '1px solid var(--border)', padding: '16px', borderRadius: '12px', background: 'var(--surface)' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-link" style={{ color: 'var(--accent)' }}></i> Vinculación de Inventario
                  </h3>
                  <p className="muted-note" style={{ marginBottom: '16px', fontSize: '12px', lineHeight: '1.4' }}>Sugerencias basadas en el nombre del producto.</p>
                  
                  {/* Sugerencias Activas */}
                  {suggestedVariants.length > 0 && (
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(124,131,255,0.05)', borderRadius: '8px', border: '1px solid rgba(124,131,255,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-soft)' }}>Coincidencias encontradas:</span>
                        <button type="button" onClick={addAllSuggestions} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }}>Vincular Todos</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {suggestedVariants.map(p => (
                          <button type="button" key={p.id} onClick={() => toggleVariantLink(p)} style={{ background: 'var(--bg-color)', border: '1px solid var(--border-highlight)', color: 'var(--text)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', textAlign: 'left' }}>
                            <i className="fa-solid fa-plus" style={{ color: 'var(--accent)', fontSize: '10px' }}></i>
                            {p.code ? `[${p.code}] ` : ''}{p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Variantes Seleccionadas */}
                  <div style={{ minHeight: '40px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-soft)', display: 'block', marginBottom: '8px' }}>Vinculados ({formData.variants.length}):</span>
                    {formData.variants.length === 0 ? (
                      <div style={{ padding: '10px', color: 'var(--muted)', fontSize: '12px', border: '1px dashed var(--border)', borderRadius: '6px', textAlign: 'center' }}>
                        Ninguna variante vinculada.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {formData.variants.map(id => {
                          const item = inventory.find(i => i.id === id);
                          return (
                            <div key={id} style={{ background: 'var(--accent)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600 }}>
                                {item ? `${item.code ? `[${item.code}] ` : ''}${item.name}` : id}
                              </span>
                              <button type="button" onClick={() => toggleVariantLink({id})} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Galería Compacta */}
                <div style={{ border: '1px dashed var(--border-strong)', padding: '16px', borderRadius: '12px', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px' }}>Imágenes</h3>
                    <button type="button" className="btn-ghost" onClick={() => fileInputRef.current.click()} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}>
                      <i className="fa-solid fa-upload" style={{ marginRight: '6px' }}></i> Subir
                    </button>
                  </div>
                  
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  
                  {previews.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '8px' }}>
                      {previews.map((src, i) => (
                        <div key={i} style={{ position: 'relative', aspectRatio: '1/1' }}>
                          <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} alt="preview" />
                          <button type="button" onClick={() => removeFile(i)} style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--muted)', fontSize: '12px' }}>
                      Sin imágenes seleccionadas.
                    </div>
                  )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={formData.isPromo} onChange={e => setFormData({...formData, isPromo: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Marcar como Producto Destacado</span>
                </label>

                <div style={{ position: 'sticky', bottom: '-24px', background: 'var(--bg-color)', padding: '16px 0', borderTop: '1px solid var(--border)', marginTop: 'auto', display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, padding: '12px' }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-solid" disabled={loading} style={{ flex: 2, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {loading ? (
                      <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</>
                    ) : (
                      <><i className="fa-solid fa-check"></i> {editProductId ? 'Actualizar' : 'Guardar'}</>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
