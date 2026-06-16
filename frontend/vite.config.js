import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El backend Express sigue sirviendo /api (REST) y /assets (imágenes, auth-global.js,
// compartidos con los portales internos) exactamente igual que antes — esta SPA solo
// reemplaza index.html y producto.html. assetsDir distinto a 'assets' para no chocar
// con la carpeta /assets existente del sitio cuando ambos se sirven desde la raíz.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'vite-assets',
  },
  server: {
    // Permite importar assets/css/style.css desde fuera de frontend/ (un nivel arriba, raíz del repo).
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:3000',
      '/assets': 'http://localhost:3000',
    },
  },
})
