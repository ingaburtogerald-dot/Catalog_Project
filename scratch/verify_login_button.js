const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

const rootHtmlFiles = [
  'index.html',
  'in-ear.html',
  'accesorios-computadoras.html',
  'kz-edx-pro.html',
  'index - Copy (2).html',
  'in-ear - Copy.html',
  'accesorios-computadoras - Copy.html'
];

const subfolderHtmlFiles = [
  'in-ear/kz-castor.html',
  'in-ear/kz-castor-pro.html',
  'in-ear/kz-edx-pro.html',
  'computadoras/attack-shark-x11.html',
  'in-ear/kz-castor - Copy.html',
  'in-ear/kz-castor-pro - Copy.html',
  'in-ear/kz-edx-pro - Copy.html',
  'computadoras/attack-shark-x11 - Copy.html'
];

const jsFiles = [
  'assets/js/producto.js',
  'assets/js/catalog.js'
];

let failed = false;

console.log('--- VERIFYING FRONTEND LOGIN BUTTONS ---');

// Verify Root HTML files
rootHtmlFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File does not exist: ${file}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const hasLink = content.includes('href="admin.html"') || content.includes("href='admin.html'");
  const hasText = content.includes('Iniciar Sesión');

  if (hasLink && hasText) {
    console.log(`✅ ${file}: OK`);
  } else {
    console.log(`❌ ${file}: FAILED (hasLink: ${hasLink}, hasText: ${hasText})`);
    failed = true;
  }
});

// Verify Subfolder HTML files
subfolderHtmlFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File does not exist: ${file}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const hasLink = content.includes('href="../admin.html"') || content.includes("href='../admin.html'");
  const hasText = content.includes('Iniciar Sesión');

  if (hasLink && hasText) {
    console.log(`✅ ${file}: OK`);
  } else {
    console.log(`❌ ${file}: FAILED (hasLink: ${hasLink}, hasText: ${hasText})`);
    failed = true;
  }
});

// Verify JS files
jsFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File does not exist: ${file}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const hasLink = content.includes('admin.html');
  const hasText = content.includes('Iniciar Sesión');

  if (hasLink && hasText) {
    console.log(`✅ ${file}: OK`);
  } else {
    console.log(`❌ ${file}: FAILED (hasLink: ${hasLink}, hasText: ${hasText})`);
    failed = true;
  }
});

console.log('\n--- SUMMARY ---');
if (failed) {
  console.log('❌ SOME VERIFICATIONS FAILED. Please review the output.');
  process.exit(1);
} else {
  console.log('🎉 ALL MODIFIED FILES HAVE "INICIAR SESIÓN" NAVIGATION!');
  process.exit(0);
}
