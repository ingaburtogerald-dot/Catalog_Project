import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useCart } from '../context/CartContext';
import { fetchConfig, fetchProduct, fetchCatalog } from '../lib/api';
import { resolveImageUrl } from '../lib/resolveImageUrl';
import { productImg } from '../components/ProductCard';

function placeholderImg(category, categories) {
  const c = categories.find((x) => x.id === category);
  const icon = c ? c.icon : '🛍️';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='460'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#f4f6ff'/><stop offset='1' stop-color='#e7ecff'/>
    </linearGradient></defs>
    <rect width='600' height='460' fill='url(#g)'/>
    <text x='300' y='250' font-size='170' text-anchor='middle' dominant-baseline='middle'>${icon}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function categoryName(id, categories) {
  const c = categories.find((x) => x.id === id);
  return c ? `${c.icon} ${c.name}` : id;
}

export default function ProductDetail() {
  const { add, config, setConfig } = useCart();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [menuOpen, setMenuOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');

  const [images, setImages] = useState([]);
  const [mainImage, setMainImage] = useState('');
  const [variant, setVariant] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await fetchConfig();
        if (!active) return;
        setConfig(cfg);
        setCategories(cfg.categories || []);

        if (!id) throw new Error('Falta el identificador del producto.');
        const p = await fetchProduct(id);
        if (!active) return;
        const imgs = (p.images && p.images.length) ? p.images : [p.img || placeholderImg(p.category, cfg.categories || [])];
        setProduct(p);
        setImages(imgs);
        setMainImage(imgs[0]);
        setVariant((p.variants && p.variants[0]) ? p.variants[0].name : '');
        setQty(1);
        document.title = `${p.name} · Gyro Store`;

        const all = await fetchCatalog();
        if (!active) return;
        setRelated(all.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4));
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => { active = false; };
  }, [id, setConfig]);

  const consultUrl = useMemo(() => {
    if (!product) return '#';
    const msg = `¡Hola Gyro Store! Me interesa el producto *${product.name}*${variant ? ` (${variant})` : ''}.`;
    return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`;
  }, [product, variant, config.whatsapp]);

  if (error) {
    return (
      <>
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} categories={categories} activeCategory="all" onSelectCategory={() => {}} />
        <main className="container">
          <div className="empty-state">
            <span className="empty-icon">😕</span>
            No se pudo cargar el producto.<br /><small>{error}</small><br />
            <Link className="btn btn--outline" to="/" style={{ marginTop: 16 }}>← Volver al catálogo</Link>
          </div>
        </main>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main className="container"><p className="empty-state">Cargando producto…</p></main>
      </>
    );
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const specs = Array.isArray(product.specs) ? product.specs : [];

  return (
    <>
      <a className="skip-link" href="#product-root">Saltar al contenido</a>

      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
        activeCategory="all"
        onSelectCategory={() => {}}
      />

      <Header onOpenMenu={() => setMenuOpen(true)} />

      <main id="product-root" className="container">
        <nav className="breadcrumb" aria-label="Migas de pan">
          <Link to="/">Inicio</Link> <span>›</span>{' '}
          <Link to={`/?cat=${encodeURIComponent(product.category)}`}>{categoryName(product.category, categories)}</Link> <span>›</span>{' '}
          <span className="current">{product.name}</span>
        </nav>

        <div id="product-detail">
          <div className="product-detail">
            <div className="gallery">
              <div className="gallery-main">
                <img id="main-image" src={resolveImageUrl(mainImage, config.oneDriveSharingUrl)} alt={product.name} />
              </div>
              {images.length > 1 && (
                <div className="gallery-thumbs">
                  {images.map((src, i) => (
                    <button
                      key={src + i}
                      className={`thumb${src === mainImage ? ' active' : ''}`}
                      aria-label={`Imagen ${i + 1}`}
                      onClick={() => setMainImage(src)}
                    >
                      <img src={resolveImageUrl(src, config.oneDriveSharingUrl)} alt={`${product.name} ${i + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="buybox">
              <span className="buy-cat">{categoryName(product.category, categories)}</span>
              <h1 className="buy-title">{product.name}</h1>
              <p className="buy-price">{config.currency}{Number(product.price).toFixed(2)} <span className="buy-price-note">precio desde</span></p>
              <p className="buy-desc">{product.desc || ''}</p>

              {variants.length > 0 && (
                <div className="buy-block">
                  <span className="buy-label">Color / variante {variants.length > 1 ? <em>(elegí una)</em> : null}</span>
                  <div className="variants">
                    {variants.map((v) => (
                      <button
                        key={v.name}
                        className={`variant${v.name === variant ? ' active' : ''}`}
                        onClick={() => { setVariant(v.name); if (v.img) setMainImage(v.img); }}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="buy-block">
                <span className="buy-label">Cantidad</span>
                <div className="qty qty--lg">
                  <button aria-label="Restar" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <span>{qty}</span>
                  <button aria-label="Sumar" onClick={() => setQty((q) => q + 1)}>+</button>
                </div>
              </div>

              <div className="buy-actions">
                <button
                  className="btn btn--add btn--lg"
                  onClick={() => add({ id: product.id, name: product.name, price: product.price, img: mainImage }, variant, qty)}
                >
                  🛒 Agregar al carrito
                </button>
                <a className="btn btn--whatsapp btn--lg" href={consultUrl} target="_blank" rel="noopener">
                  <span aria-hidden="true">🟢</span> Consultar
                </a>
              </div>
            </div>
          </div>
        </div>

        <section id="product-info">
          <div className="info-grid">
            <div className="info-card">
              <h2 className="info-title">Descripción</h2>
              <p className="info-text">{product.desc || 'Sin descripción.'}</p>
            </div>
            <div className="info-card">
              <h2 className="info-title">Especificaciones técnicas</h2>
              {specs.length ? (
                <table className="specs">
                  <tbody>
                    {specs.map((s) => <tr key={s.label}><th>{s.label}</th><td>{s.value}</td></tr>)}
                  </tbody>
                </table>
              ) : <p className="info-text">Próximamente.</p>}
            </div>
          </div>
        </section>

        {related.length > 0 && (
          <section id="related">
            <h2 className="section-title">También te puede interesar</h2>
            <div className="catalog-grid">
              {related.map((p) => (
                <article className="card" key={p.id}>
                  <Link className="card-link" to={`/producto.html?id=${encodeURIComponent(p.id)}`}>
                    <div className="card-media">
                      <span className="card-tag">{p.category}</span>
                      <img src={productImg(p, categories, config.oneDriveSharingUrl)} alt={p.name} loading="lazy" width="320" height="240" />
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{p.name}</h3>
                      <p className="card-price">Desde {config.currency}{Number(p.price).toFixed(2)}</p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <p>© <span>{new Date().getFullYear()}</span> Gyro Store · Hecho por <strong>Ing. Gerald Aburto</strong></p>
        <p>Contacto: <a href="mailto:ingaburtogerald@gmail.com">ingaburtogerald@gmail.com</a></p>
      </footer>
    </>
  );
}
