export default function Header({ onOpenMenu }) {
  return (
    <header className="nav-premium">
      <div className="nav-left">
        <button className="nav-icon-btn" aria-label="Abrir menú lateral" aria-controls="sidebar" aria-expanded="false" onClick={onOpenMenu}>
          <i className="fa-solid fa-bars"></i>
        </button>
        <a href="/" className="nav-brand">
          <img src="/assets/img/Gyro_Store_logo.jpeg" alt="Logo de Gyro Store" />
          <span>GYRO STORE</span>
        </a>
      </div>

      <div className="nav-right">
        <div className="nav-social">
          <a href="https://www.instagram.com/store_gyro/" target="_blank" rel="noopener" className="nav-icon-btn" title="Instagram">
            <i className="fa-brands fa-instagram"></i>
          </a>
          <a href="https://www.facebook.com/profile.php?id=61589182888082" target="_blank" rel="noopener" className="nav-icon-btn" title="Facebook">
            <i className="fa-brands fa-facebook"></i>
          </a>
          <a href="https://www.tiktok.com/@gyro_store" target="_blank" rel="noopener" className="nav-icon-btn" title="TikTok">
            <i className="fa-brands fa-tiktok"></i>
          </a>
          <a href="/gyrologistics.html" className="nav-icon-btn" title="Gyro Logistics — Seguimiento de tus compras desde China">
            <i className="fa-solid fa-box"></i>
          </a>
          <a href="https://maps.app.goo.gl/r5pFyiZN5zi4g7Q1A" target="_blank" rel="noopener" className="nav-icon-btn" title="Cómo llegar">
            <i className="fa-solid fa-location-dot"></i>
          </a>
        </div>
        <a href="https://wa.me/50585944758" target="_blank" rel="noopener" className="nav-whatsapp">
          <i className="fa-brands fa-whatsapp"></i> <span>WhatsApp</span>
        </a>
      </div>
    </header>
  );
}
