const http = require('http');

function postPurchase() {
  const data = JSON.stringify({
    lote: 'LT_TEST_37',
    date: '2026-06-14',
    status: 'Pedido',
    items: [
      {
        code: 'TEST-37',
        product: 'KZ EDX Pro | Mic | Transparente',
        qty: 10,
        cost: 5.00,
        tax: 0.50
        // exchangeRate is omitted to test fallback to 37.00
      }
    ]
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/purchases',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'Authorization': 'Bearer dev-token'
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      try {
        const json = JSON.parse(body);
        console.log('RESPONSE:', JSON.stringify(json, null, 2));
        if (json && json[0]) {
          const item = json[0];
          console.log('\n--- VERIFICATION ---');
          console.log('Exchange Rate:', item.exchangeRate, item.exchangeRate === 37 ? '✅ PASS' : '❌ FAIL');
          console.log('Unit Cost:', item.unitCost, item.unitCost === 5.5 ? '✅ PASS' : '❌ FAIL');
          console.log('Total USD:', item.totalUsd, item.totalUsd === 55 ? '✅ PASS' : '❌ FAIL');
          console.log('Total NIO:', item.totalNio, item.totalNio === 55 * 37 ? '✅ PASS' : '❌ FAIL');
          
          // Now clean up by deleting this purchase
          deletePurchase(item.id);
        } else {
          console.log('❌ Invalid response structure');
        }
      } catch (err) {
        console.log('Error parsing response:', err.message);
        console.log('Raw body:', body);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(data);
  req.end();
}

function deletePurchase(id) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/purchases/${id}`,
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer dev-token'
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log('\nCleanup STATUS:', res.statusCode);
      console.log('Cleanup RESPONSE:', body);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with cleanup request: ${e.message}`);
  });

  req.end();
}

postPurchase();
