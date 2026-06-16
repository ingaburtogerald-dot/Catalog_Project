import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

export function productImg(p, categories) {
  return (p.images && p.images[0]) || p.img || placeholderImg(p, categories);
}

export default function ProductCard({ product, categories, index = 0, isEditMode = false, canEdit = false, onEdit }) {
  const { add, money, config } = useCart();
  const href = `/producto.html?id=${encodeURIComponent(product.id)}`;
  const hasVariants = product.variants && product.variants.length > 1;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    disabled: !canEdit || !isEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      className="card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
    >
      {isEditMode && canEdit && (
        <div 
          {...attributes} 
          {...listeners} 
          style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px', borderRadius: '50%', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Arrastrar"
        >
          <i className="fa-solid fa-grip-vertical"></i>
        </div>
      )}
      {isEditMode && (
        <button 
          onClick={() => onEdit(product.id)}
          style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'var(--accent)', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer' }}
        >
          ✏️ Editar
        </button>
      )}
      <Link className="card-link" to={href} aria-label={`Ver ${product.name}`}>
        <div className="card-media">
          <span className="card-tag">{product.category}</span>
          <img
            src={productImg(product, categories)}
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
            onClick={() => add({ id: product.id, name: product.name, price: product.price, img: productImg(product, categories) })}
          >
            🛒
          </button>
        </div>
      </div>
    </motion.article>
  );
}
