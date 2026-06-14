const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

const filesToVerify = {
  'assets/js/admin.js': [
    "localStorage.setItem('gyro_admin_logged_in', 'true')",
    "const fromPage = urlParams.get('from')",
    "window.location.href = fromPage",
    "localStorage.removeItem('gyro_admin_logged_in')",
    "signOut(auth)"
  ],
  'script.js': [
    "const isAdmin = localStorage.getItem('gyro_admin_logged_in') === 'true'",
    "loginLink.href = `${basePath}admin.html?from=${currentUrl}`",
    "loginLink.href = `${basePath}admin.html\${devQuery}`",
    "Cerrar Sesión"
  ],
  'assets/js/script.js': [
    "const isAdmin = localStorage.getItem('gyro_admin_logged_in') === 'true'",
    "loginLink.href = `${basePath}admin.html?from=${currentUrl}`",
    "loginLink.href = `${basePath}admin.html\${devQuery}`",
    "Cerrar Sesión"
  ],
  'assets/js/producto.js': [
    "const isAdmin = localStorage.getItem('gyro_admin_logged_in') === 'true'",
    "adminMenu = `<li><a href=\"\${basePath}admin.html?from=\${currentUrl}\">"
  ],
  'assets/js/catalog.js': [
    "const isAdmin = localStorage.getItem('gyro_admin_logged_in') === 'true'",
    "adminMenu = `<li><a href=\"\${basePath}admin.html?from=\${currentUrl}\">"
  ]
};

let failed = false;

console.log('--- VERIFYING REDIRECTION LOGIC CODE ---');

Object.entries(filesToVerify).forEach(([file, patterns]) => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${file}`);
    failed = true;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let fileOk = true;

  patterns.forEach(pattern => {
    // Strip escape characters for logging
    const cleanPattern = pattern.replace(/\\/g, '');
    const found = content.includes(pattern);
    if (!found) {
      console.log(`  ❌ ${file}: Missing pattern "${cleanPattern}"`);
      fileOk = false;
      failed = true;
    }
  });

  if (fileOk) {
    console.log(`✅ ${file}: All patterns found!`);
  }
});

console.log('\n--- SUMMARY ---');
if (failed) {
  console.log('❌ SOME CODE PATTERNS ARE MISSING. Verification failed.');
  process.exit(1);
} else {
  console.log('🎉 ALL CODE PATTERNS FOR CONTEXT REDIRECTION VERIFIED SUCCESSFULLY!');
  process.exit(0);
}
