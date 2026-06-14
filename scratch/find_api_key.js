const https = require('https');

const baseKey = 'AIzaSyBLY5gl79jcWKtWfRzXqeuuNnySFBkHW-w';

// Let's generate permutations of lookalikes:
// Position 7 (index 7): 'L' -> 'L', 'I', '1'
// Position 10 (index 10): 'l' -> 'l', 'I', '1'
// Position 14 (index 14): 'W' -> 'W', 'w'
// Position 15 (index 15): 'k' -> 'k', 'K'
// Position 16 (index 16): 't' -> 't', 'T'
// Position 17 (index 17): 'W' -> 'W', 'w'
// Position 21 (index 21): 'X' -> 'X', 'x'

function replaceAt(str, index, replacement) {
  return str.substr(0, index) + replacement + str.substr(index + replacement.length);
}

const pos7 = ['L', 'I', '1'];
const pos10 = ['l', 'I', '1'];
const pos14 = ['W', 'w'];
const pos15 = ['k', 'K'];
const pos16 = ['t', 'T'];
const pos17 = ['W', 'w'];
const pos21 = ['X', 'x'];

const keys = [];

for (const p7 of pos7) {
  for (const p10 of pos10) {
    for (const p14 of pos14) {
      for (const p15 of pos15) {
        for (const p16 of pos16) {
          for (const p17 of pos17) {
            for (const p21 of pos21) {
              let key = baseKey;
              key = replaceAt(key, 7, p7);
              key = replaceAt(key, 11, p10); // 'l' is at index 11: A-I-z-a-S-y-B-L-Y-5-g-l -> index 11
              key = replaceAt(key, 16, p14); // 'W' is after jc (index 16)
              key = replaceAt(key, 17, p15); // 'k' (index 17)
              key = replaceAt(key, 18, p16); // 't' (index 18)
              key = replaceAt(key, 19, p17); // 'W' (index 19)
              key = replaceAt(key, 23, p21); // 'X' (index 23)
              if (!keys.includes(key)) {
                keys.push(key);
              }
            }
          }
        }
      }
    }
  }
}

console.log(`Generated ${keys.length} key variations to test.`);

function checkKey(key) {
  return new Promise((resolve) => {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error && parsed.error.message.includes('API key not valid')) {
            resolve({ key, valid: false });
          } else {
            // If it's another error (like dynamic link not enabled or bad request, it means the key is VALID!)
            resolve({ key, valid: true, response: parsed });
          }
        } catch (e) {
          resolve({ key, valid: false });
        }
      });
    });
    req.on('error', () => resolve({ key, valid: false }));
    req.write('{}');
    req.end();
  });
}

async function run() {
  const batchSize = 20;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    console.log(`Testing batch ${i} to ${i + batch.length}...`);
    const results = await Promise.all(batch.map(checkKey));
    const valid = results.find(r => r.valid);
    if (valid) {
      console.log('SUCCESS! Found valid key:', valid.key);
      console.log('Response:', JSON.stringify(valid.response));
      process.exit(0);
    }
  }
  console.log('Tested all variations. None were valid.');
}

run();
