import { useState, useEffect, useRef } from 'react';
import { fetchProducts, fetchConfig } from '../../../lib/api';

export default function CatalogForm({ user }) {
  const [categories, setCategories] = useState([]);
  const [inventory, setInventory] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    desc: '',
    variants: [],
    isPromo: false
  });
  
  const [suggestedVariants, setSuggestedVariants] = useState([]);
  
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchConfig().then(cfg => {
      if (cfg.categories) setCategories(cfg.categories);
    }).catch(() => {});
    
    fetchProducts().then(res => setInventory(res)).catch(() => {});
  }, []);

  // AUTO-MATCH LÓGICA (Debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.name.trim().length > 2) {
        const query = formData.name.toLowerCase();
        const matches = inventory.filter(p => 
          p.name.toLowerCase().includes(query) && !formData.variants.includes(p.id)
        );
        setSuggestedVariants(matches);
      } else {
        setSuggestedVariants([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.name, inventory, formData.variants]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
    
    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviews(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };
  
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const addVariant = (id) => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, id]
    }));
  };

  const removeVariant = (id) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v !== id)
    }));
  };

  const addAllSuggestions = () => {
    const newVariants = suggestedVariants.map(v => v.id);
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, ...newVariants]
    }));
    setSuggestedVariants([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.category) {
      setMsg({ type: 'error', text: 'El nombre y la categoría son requeridos.' });
      return;
    }
    
    setLoading(true);
    setMsg({ type: 'info', text: 'Subiendo imágenes...' });

    try {
      const token = await user.getIdToken();
      let uploadedUrls = [];
      
      if (files.length > 0) {
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
        images: uploadedUrls
      };

      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando en catálogo');

      setMsg({ type: 'success', text: '¡Producto publicado con éxito en el catálogo!' });
      setFormData({ name: '', category: '', desc: '', variants: [], isPromo: false });
      setFiles([]);
      setPreviews([]);
      setSuggestedVariants([]);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel card-glass" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-cube" style={{ color: 'var(--accent)' }}></i> Crear Producto Público
        </h2>
        <p className="muted-note" style={{ margin: 0 }}>Define los detalles comerciales y enlaza este producto con tus ítems de inventario físico.</p>
      </div>

      {msg.text && (
        <div style={{ padding: '14px 20px', borderRadius: '8px', marginBottom: '24px', background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: msg.type === 'error' ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
          <i className={`fa-solid ${msg.type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}></i>
          {msg.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          
          {/* COLUMNA IZQUIERDA: Info Principal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="grid-form" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
              <label style={{ margin: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '6px', display: 'block' }}>Nombre del Producto General</span>
                <input 
                  type="text" 
                  placeholder="Ej. KZ EDX Pro X" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)' }}
                />
              </label>
              
              <label style={{ margin: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '6px', display: 'block' }}>Categoría</span>
                <select 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})} 
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--input-border)', background: 'var(--input-bg)' }}
                >
                  <option value="">Seleccione una categoría...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)' }}>
              Descripción (Pública)
              <textarea 
                placeholder="Descripción detallada que verá el cliente..." 
                value={formData.desc}
                onChange={e => setFormData({...formData, desc: e.target.value})}
                style={{ minHeight: '100px', padding: '12px', borderRadius: '8px', background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text)', resize: 'vertical' }}
              />
            </label>

            {/* Vinculación Inteligente */}
            <div style={{ border: '1.5px solid var(--border)', padding: '20px', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-link" style={{ color: 'var(--accent)' }}></i> Vinculación de Inventario
              </h3>
              <p className="muted-note" style={{ marginBottom: '16px', fontSize: '12px' }}>A medida que escribas el Nombre del Producto, sugeriremos códigos de inventario compatibles.</p>
              
              {/* Sugerencias Activas */}
              {suggestedVariants.length > 0 && (
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(124,131,255,0.05)', borderRadius: '8px', border: '1px solid rgba(124,131,255,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-soft)' }}>Sugerencias Automáticas:</span>
                    <button type="button" onClick={addAllSuggestions} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px' }}>Vincular Todos</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {suggestedVariants.map(p => (
                      <button type="button" key={p.id} onClick={() => addVariant(p.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border-highlight)', color: 'var(--text)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                        <i className="fa-solid fa-plus" style={{ color: 'var(--accent)', fontSize: '10px' }}></i>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Variantes Seleccionadas */}
              <div style={{ minHeight: '60px' }}>
                {formData.variants.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                    Ninguna variante física seleccionada aún.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {formData.variants.map(id => {
                      const item = inventory.find(i => i.id === id);
                      return (
                        <div key={id} style={{ background: 'var(--accent)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          <span style={{ fontWeight: 600 }}>{item ? item.name : id}</span>
                          <button type="button" onClick={() => removeVariant(id)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Galería y Acciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '2px dashed var(--border-highlight)', padding: '24px 16px', borderRadius: '16px', textAlign: 'center', background: 'var(--surface)', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(124,131,255,0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', fontSize: '20px' }}>
                  <i className="fa-regular fa-image"></i>
                </div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Galería de Imágenes</h3>
                <p className="muted-note" style={{ margin: 0, fontSize: '12px' }}>Sube imágenes en alta calidad para el catálogo.</p>
              </div>

              <input 
                type="file" 
                multiple 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button type="button" className="btn-ghost" onClick={() => fileInputRef.current.click()} style={{ width: '100%', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>
                <i className="fa-solid fa-upload"></i> Seleccionar Fotos
              </button>
              
              {/* Miniaturas en Grid Compacto */}
              {previews.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '10px', marginTop: 'auto' }}>
                  {previews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1/1' }}>
                      <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} alt={`Preview ${i}`} />
                      <button type="button" onClick={() => removeFile(i)} style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <input type="checkbox" checked={formData.isPromo} onChange={e => setFormData({...formData, isPromo: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
                <div>
                  <span style={{ fontWeight: 600, fontSize: '14px', display: 'block' }}>Producto Destacado</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-soft)' }}>Marcar como Promoción Principal</span>
                </div>
              </label>

              <button type="submit" className="btn-solid" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? (
                  <><i className="fa-solid fa-circle-notch fa-spin"></i> Publicando...</>
                ) : (
                  <><i className="fa-solid fa-cloud-arrow-up"></i> Publicar en Catálogo</>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
