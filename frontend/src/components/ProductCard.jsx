import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { resolveImageUrl } from '../lib/resolveImageUrl';

function placeholderImg(product, categories) {
  const cat = categories.find((c) => c.id === product.category);
  const icon = cat ? cat.icon : '🛍️';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='240'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#f4f6ff'/><stop offset='1' stop-color='#e7ecff'/>
    </linearGradient></defs>
    <rect width='320' height='240' fill='url(#g)'/>
    <text x='160' y='130' font-size='90' text-anchor='middle' dominant-baseline='middle'>${icon}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function productImg(p, categories, oneDriveSharingUrl) {
  const raw = (p.images && p.images[0]) || p.img || placeholderImg(p, categories);
  return resolveImageUrl(raw, oneDriveSharingUrl);
}

export default function ProductCard({ product, categories, index = 0 }) {
  const { add, money, config } = useCart();
  const href = `/producto.html?id=${encodeURIComponent(product.id)}`;
  const hasVariants = product.variants && product.variants.length > 1;

  return (
    <motion.article
      className="card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link className="card-link" to={href} aria-label={`Ver ${product.name}`}>
        <div className="card-media">
          <span className="card-tag">{product.category}</span>
          <img
            src={productImg(product, categories, config.oneDriveSharingUrl)}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width="320"
            height="240"
          />
        </div>
      </Link>
      <div className="card-body">
        <Link className="card-link" to={href}><h3 className="card-title">{product.name}</h3></Link>
        <p className="card-desc">{product.desc}</p>
        {hasVariants && <p className="card-variants">{product.variants.length} variantes disponibles</p>}
        <p className="card-price">Desde {money(product.price)}</p>
        <div className="card-actions">
          <Link className="btn btn--outline" to={href}>Ver detalles</Link>
          <button
            className="btn btn--add"
            aria-label={`Agregar ${product.name}`}
            onClick={() => add({ id: product.id, name: product.name, price: product.price, img: productImg(product, categories, config.oneDriveSharingUrl) })}
          >
            🛒
          </button>
        </div>
      </div>
    </motion.article>
  );
}
