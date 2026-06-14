const http = require('http');

function checkPage(urlPath, expectedStrings) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${urlPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`\nChecking: ${urlPath} -> STATUS: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          console.log(`❌ Page failed to load! Status: ${res.statusCode}`);
          resolve(false);
          return;
        }
        let allPassed = true;
        for (const str of expectedStrings) {
          const found = body.includes(str);
          console.log(`  Contains "${str}":`, found ? '✅' : '❌ FAIL');
          if (!found) allPassed = false;
        }
        resolve(allPassed);
      });
    }).on('error', (err) => {
      console.log(`❌ Network Error on ${urlPath}:`, err.message);
      resolve(false);
    });
  });
}

async function verifyAll() {
  const p1 = await checkPage('/', [
    'assets/css/style.css',
    'assets/js/cart.js',
    'assets/js/catalog.js'
  ]);

  const p2 = await checkPage('/producto.html?id=kz-edx-pro-x', [
    'assets/css/style.css',
    'assets/js/cart.js',
    'assets/js/producto.js'
  ]);

  const p3 = await checkPage('/admin.html?dev=true', [
    'assets/css/style.css',
    'assets/js/admin.js'
  ]);

  const p4 = await checkPage('/in-ear/kz-edx-pro.html', [
    '../assets/css/style.css',
    '../assets/js/script.js'
  ]);

  const p5 = await checkPage('/computadoras/attack-shark-x11.html', [
    '../assets/css/style.css',
    '../assets/js/script.js'
  ]);

  const allOk = p1 && p2 && p3 && p4 && p5;
  console.log('\n--- VERIFICATION RESULT ---');
  console.log(allOk ? '🎉 ALL PATHS VERIFIED SUCCESSFULLY!' : '❌ SOME PATHS FAILED');
}

verifyAll();
