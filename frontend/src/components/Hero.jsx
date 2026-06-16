import { motion } from 'framer-motion';

export default function Hero({ searchTerm, onSearch, productCount }) {
  return (
    <section className="hero-premium" aria-label="Bienvenida">
      <div className="hero-aurora" aria-hidden="true"></div>
      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="hero-eyebrow"><i className="fa-solid fa-bolt"></i> Managua, Nicaragua</span>
        <h1 className="hero-title">
          Sonido y tecnología<br />
          <span className="hero-title-grad">que se sienten premium</span>
        </h1>
        <p className="hero-subtitle">
          Audífonos in-ear KZ, headsets gaming y accesorios. Venta al detalle y por mayor,
          con descuento automático por volumen.
        </p>

        <label className="hero-search">
          <span className="search-icon" aria-hidden="true"><i className="fa-solid fa-magnifying-glass"></i></span>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar audífonos, mouse…"
            autoComplete="off"
          />
        </label>

        <div className="hero-meta">
          <span><strong>{productCount}</strong> productos disponibles</span>
          <a href="https://wa.me/50585944758" target="_blank" rel="noopener" className="hero-whatsapp">
            <i className="fa-brands fa-whatsapp"></i> Escríbenos por WhatsApp
          </a>
        </div>
      </motion.div>
    </section>
  );
}
