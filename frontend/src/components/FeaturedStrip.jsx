import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { productImg } from './ProductCard';

export default function FeaturedStrip({ products, categories }) {
  const { money, config } = useCart();
  const featured = products.filter((p) => p.featured);
  if (!featured.length) return null;

  return (
    <section className="featured-strip" aria-label="Productos destacados">
      <h2 className="featured-title"><i className="fa-solid fa-star"></i> Destacados</h2>
      <div className="featured-row">
        {featured.map((p, i) => (
          <motion.div
            className="featured-card"
            key={p.id}
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.06, 0.3) }}
          >
            <Link to={`/producto.html?id=${encodeURIComponent(p.id)}`}>
              <img src={productImg(p, categories, config.oneDriveSharingUrl)} alt={p.name} loading="lazy" />
              <div className="featured-card-body">
                <span className="featured-card-name">{p.name}</span>
                <span className="featured-card-price">{money(p.price)}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
