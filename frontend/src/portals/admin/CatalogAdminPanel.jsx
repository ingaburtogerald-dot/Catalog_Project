import { useState, useEffect } from 'react';
import PortalLayout from '../layout/PortalLayout';
import CatalogForm from './components/CatalogForm';
import PromoManager from './components/PromoManager';

export default function CatalogAdminPanel({ user, signOutPortal }) {
  const [activeTab, setActiveTab] = useState('create');
  const isAdmin = user.roles && (user.roles.includes('admin') || user.roles.includes('global_admin'));

  if (!isAdmin) {
    return (
      <PortalLayout title="Catálogo" icon="📦" user={user} signOutPortal={signOutPortal}>
        <div className="panel card-glass" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Acceso Denegado</h2>
          <p className="muted-note">No tienes permisos para acceder a esta área.</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Gestión de Catálogo" icon="🏷️" user={user} signOutPortal={signOutPortal} currentPortal="catalogo">
      <div className="portal-theme">
        <div className="admin-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-soft)', fontSize: '14px', fontWeight: '600' }}>
            <a href="/inventario" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              <i className="fa-solid fa-warehouse"></i> Gestión de Inventario
            </a>
            <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--border-strong)' }}></i>
            <span style={{ color: 'var(--heading-color)' }}>Gestión de Catálogo</span>
          </div>
          <h1 style={{ marginTop: '8px', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-tags" style={{ color: 'var(--accent)' }}></i> 
            Gestor del Catálogo Público
          </h1>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            + Crear Producto
          </button>
          <button 
            className={`tab ${activeTab === 'promo' ? 'active' : ''}`}
            onClick={() => setActiveTab('promo')}
          >
            ⭐ Gestor de Promociones
          </button>
        </div>

        {activeTab === 'create' && <CatalogForm user={user} />}
        {activeTab === 'promo' && <PromoManager user={user} />}
      </div>
    </PortalLayout>
  );
}
