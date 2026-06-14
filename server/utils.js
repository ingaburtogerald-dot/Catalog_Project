// Envuelve handlers async para que los errores lleguen al middleware de errores de Express.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Normaliza/valida los datos de un producto que llegan del cliente.
function sanitizeProduct(body = {}) {
  const out = {};
  if (typeof body.name === 'string') out.name = body.name.trim();
  if (typeof body.category === 'string') out.category = body.category.trim();
  if (typeof body.desc === 'string') out.desc = body.desc.trim();
  if (typeof body.img === 'string') out.img = body.img.trim();
  if (body.price != null && !Number.isNaN(Number(body.price))) out.price = Number(body.price);
  if (body.featured != null) out.featured = Boolean(body.featured);

  // Galería de imágenes (array de URLs)
  if (Array.isArray(body.images)) {
    out.images = body.images.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  }
  // Variantes (colores/modelos): array de { name, img? }
  if (Array.isArray(body.variants)) {
    out.variants = body.variants
      .map((v) => {
        if (typeof v === 'string' && v.trim()) return { name: v.trim(), img: '' };
        if (v && typeof v.name === 'string' && v.name.trim()) {
          return { name: v.name.trim(), img: typeof v.img === 'string' ? v.img.trim() : '' };
        }
        return null;
      })
      .filter(Boolean);
  }
  // Especificaciones técnicas: array de { label, value }
  if (Array.isArray(body.specs)) {
    out.specs = body.specs
      .map((s) => (s && typeof s.label === 'string' && typeof s.value === 'string' && s.label.trim()
        ? { label: s.label.trim(), value: s.value.trim() }
        : null))
      .filter(Boolean);
  }
  return out;
}

module.exports = { asyncHandler, sanitizeProduct };
