// Port fiel de window.resolveImageUrl en assets/js/cart.js — convierte rutas de
// OneDrive (images_resources/...) en un link de descarga directa de Graph/OneDrive.
export function resolveImageUrl(path, oneDriveSharingUrl) {
  if (!oneDriveSharingUrl || !path) return path;
  if (!path.includes('images_resources/')) return path;

  try {
    const base64 = btoa(oneDriveSharingUrl).replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
    const token = 'u!' + base64;
    const cleanPath = path.substring(path.indexOf('images_resources/') + 'images_resources/'.length);
    const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
    return `https://api.onedrive.com/v1.0/shares/${token}/root:/${encodedPath}:/content`;
  } catch (e) {
    console.error('Error resolving OneDrive image:', e);
    return path;
  }
}
