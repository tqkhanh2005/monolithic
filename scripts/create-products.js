const { sql } = require('./demo');
const fs = require('node:fs');
const path = require('node:path');
const x = Number(sql('INSERT INTO "Product" (pname,price,quantity) VALUES (\'Product X\',100,10) RETURNING pid;'));
const y = Number(sql('INSERT INTO "Product" (pname,price,quantity) VALUES (\'Product Y\',200,20) RETURNING pid;'));
if (!Number.isInteger(x) || x < 1 || !Number.isInteger(y) || y < 1) throw new Error('SQL did not return valid product ids');
const environment = { name: 'P2 - products created by SQL CLI', values: [
  { key: 'baseUrl', value: `http://localhost:${process.env.HOST_PORT || 3002}`, enabled: true },
  { key: 'pidX', value: String(x), enabled: true }, { key: 'pidY', value: String(y), enabled: true },
], _postman_variable_scope: 'environment' };
fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../artifacts/P2-CLI.postman_environment.json'), JSON.stringify(environment, null, 2));
console.log(`Created using PostgreSQL CLI: X pid=${x}, quantity=10; Y pid=${y}, quantity=20.`);
console.log('Import artifacts/P2-CLI.postman_environment.json into Postman and select it before running the collection.');
