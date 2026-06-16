export function groupProducts(products) {
  const groups = {};

  products.forEach((p) => {
    let baseName = p.name;
    let variantName = 'Estándar';

    // Intentar detectar delimitadores comunes como '|' o '-'
    if (p.name.includes('|')) {
      const parts = p.name.split('|');
      baseName = parts[0].trim();
      variantName = parts.slice(1).join('|').trim();
    } else if (p.name.includes(' - ')) {
      const parts = p.name.split(' - ');
      baseName = parts[0].trim();
      variantName = parts.slice(1).join(' - ').trim();
    }

    if (!groups[baseName]) {
      groups[baseName] = {
        baseName,
        price: p.price,
        totalStock: 0,
        variants: []
      };
    }

    groups[baseName].totalStock += (p.stock || 0);
    groups[baseName].variants.push({
      ...p,
      variantName
    });
  });

  // Convertir el objeto de grupos en un array y ordenarlo por nombre base
  return Object.values(groups).sort((a, b) => a.baseName.localeCompare(b.baseName));
}
