const https = require('https');
const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '..', 'images_resources', 'KZ Castor Pro');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const images = [
  {
    url: 'https://conceptkart.com/cdn/shop/files/Concept-Kart-KZ-Castor-Pro-Dual-Dynamic-Driver-IEM-Black-02_46d55e5a-9dd1-4dee-ae78-ce0c66562a32.jpg',
    filename: 'Harman-Mic.jpeg'
  },
  {
    url: 'https://conceptkart.com/cdn/shop/files/Concept-Kart-KZ-Castor-Pro-Dual-Dynamic-Driver-IEM-Black-02.jpg',
    filename: 'Harman-no-Mic.jpeg'
  },
  {
    url: 'https://conceptkart.com/cdn/shop/files/Concept-Kart-KZ-Castor-Pro-Dual-Dynamic-Driver-IEM-Black-02_09779988-284b-44bc-8491-ce293f63f5c1.jpg',
    filename: 'Bass-Mic.jpeg'
  },
  {
    url: 'https://conceptkart.com/cdn/shop/files/Concept-Kart-KZ-Castor-Pro-Dual-Dynamic-Driver-IEM-Black-02_b554dd98-622d-4466-932b-55e785cf1140.jpg',
    filename: 'Bass-No-Mic.jpeg'
  }
];

function download(url, filename) {
  return new Promise((resolve, reject) => {
    const fileDest = path.join(destDir, filename);
    const file = fs.createWriteStream(fileDest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (Status: ${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${filename} successfully.`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(fileDest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Starting downloads...');
  for (const img of images) {
    try {
      await download(img.url, img.filename);
    } catch (e) {
      console.error(`Error downloading ${img.filename}:`, e.message);
    }
  }
  console.log('Finished downloads.');
}

run();
