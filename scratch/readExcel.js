const XLSX = require('xlsx');

const workbook = XLSX.readFile('scratch/Control_Inventario_2026.xlsx');
console.log('Sheets:', workbook.SheetNames); const sheetName = 'Pagos';
const sheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // read as array of arrays to see headers and structure

console.log(`Sheet: ${sheetName}`);
console.log('--- HEADERS (Row 1) ---');
console.log(JSON.stringify(data[0], null, 2));
console.log('--- DATA (Row 2 to 5) ---');
for (let i = 1; i < 5 && i < data.length; i++) {
  console.log(`Row ${i + 1}:`, JSON.stringify(data[i], null, 2));
}

// Check what M691 is by finding the letter column index.
// A=0, B=1, ..., M=12
const mColumnIndex = 12; 
console.log(`\nHeader for Column M (index 12): ${data[0] ? data[0][mColumnIndex] : 'Not Found'}`);






