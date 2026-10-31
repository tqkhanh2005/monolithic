const fs = require('node:fs');
const path = require('node:path');
function item(name, method, endpoint, body, token, code, extra = [], before = []) {
  const request = { method, url: '{{baseUrl}}' + endpoint, header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [], auth: token ? { type: 'bearer', bearer: [{ key: 'token', value: '{{' + token + '}}', type: 'string' }] } : { type: 'noauth' } };
  if (body) request.body = { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body), options: { raw: { language: 'json' } } };
  const event = [{ listen: 'test', script: { type: 'text/javascript', exec: [`pm.test('HTTP ${code}',()=>pm.response.to.have.status(${code}));`, ...extra] } }];
  if (before.length) event.unshift({ listen: 'prerequest', script: { type: 'text/javascript', exec: before } });
  return { name, request, event };
}
const save = (key, field) => `if(pm.response.code<300)pm.collectionVariables.set('${key}',pm.response.json().${field});`;
const collection = { info: { name: 'P2 Monolithic - exact rubric flow', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'First run node scripts/create-products.js to create X and Y by SQL CLI; import and select artifacts/P2-CLI.postman_environment.json. Run this collection once per fresh X/Y pair.' },
  variable: Object.entries({ baseUrl: 'http://localhost:3002', pidX: '', pidY: '', username: '', password: 'P@ss12345', adminPassword: 'Admin@123', shipperPassword: 'Shipper@123', token: '', adminToken: '', staffToken: '', uid: '', oid: '', shipid: '' }).map(([key, value]) => ({ key, value })),
  item: [
    item('Health with PostgreSQL', 'GET', '/api/health', undefined, undefined, 200),
    item('Admin login', 'POST', '/api/auth/login', { username: 'admin', password: '{{adminPassword}}' }, undefined, 200, [save('adminToken', 'accessToken')]),
    item('Staff login', 'POST', '/api/auth/login', { username: 'shipper1', password: '{{shipperPassword}}' }, undefined, 200, [save('staffToken', 'accessToken')]),
    item('Register new account', 'POST', '/api/auth/register', { username: '{{username}}', password: '{{password}}' }, undefined, 201, [save('uid', 'uid')], ["pm.collectionVariables.set('username','p2_' + Date.now());"]),
    item('Duplicate account', 'POST', '/api/auth/register', { username: '{{username}}', password: '{{password}}' }, undefined, 409),
    item('Login and save JWT', 'POST', '/api/auth/login', { username: '{{username}}', password: '{{password}}' }, undefined, 200, [save('token', 'accessToken')]),
    item('Verify normal and score 10', 'GET', '/api/customers/{{uid}}', undefined, 'token', 200, ["pm.test('Role normal, score 10',()=>{pm.expect(pm.response.json().role).to.eql('normal');pm.expect(pm.response.json().membership.score).to.eql(10);});"]),
    item('Get CLI-created X', 'GET', '/api/products/{{pidX}}', undefined, 'token', 200),
    item('Get CLI-created Y', 'GET', '/api/products/{{pidY}}', undefined, 'token', 200),
    item('Order without token', 'POST', '/api/orders', '{"items":[{"pid":{{pidX}},"qty":2},{"pid":{{pidY}},"qty":5}]}', undefined, 401),
    item('Order X2 Y5 with JWT', 'POST', '/api/orders', '{"items":[{"pid":{{pidX}},"qty":2},{"pid":{{pidY}},"qty":5}]}', 'token', 201, [save('oid', 'oid'), save('shipid', 'shipment.shipid'), "pm.test('Correct total and current time',()=>{pm.expect(pm.response.json().total_amount).to.eql(1200);pm.expect(Math.abs(Date.now()-Date.parse(pm.response.json().createdAt))).to.be.below(30000);});"]),
    item('Order and details', 'GET', '/api/orders/{{oid}}', undefined, 'token', 200, ["pm.test('Exactly X2 Y5',()=>pm.expect(pm.response.json().items.map(i=>i.qty)).to.eql([2,5]));"]),
    item('Shipment PENDING', 'GET', '/api/shipments/{{shipid}}', undefined, 'token', 200, ["pm.test('PENDING',()=>pm.expect(pm.response.json().status).to.eql('PENDING'));"]),
    item('Customer cannot change shipment', 'PATCH', '/api/shipments/{{shipid}}/status', { status: 'SHIPPING' }, 'token', 403),
    item('Staff changes shipment', 'PATCH', '/api/shipments/{{shipid}}/status', { status: 'SHIPPING' }, 'staffToken', 200),
    item('Shipment SHIPPING', 'GET', '/api/shipments/{{shipid}}', undefined, 'token', 200, ["pm.test('SHIPPING',()=>pm.expect(pm.response.json().status).to.eql('SHIPPING'));"]),
    item('X stock is 8', 'GET', '/api/products/{{pidX}}', undefined, 'token', 200, ["pm.test('X = 8',()=>pm.expect(pm.response.json().quantity).to.eql(8)) ;"]),
    item('Y stock is 15', 'GET', '/api/products/{{pidY}}', undefined, 'token', 200, ["pm.test('Y = 15',()=>pm.expect(pm.response.json().quantity).to.eql(15)) ;"]),
  ],
};
fs.mkdirSync(path.join(__dirname, '../postman'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../postman/P2.postman_collection.json'), JSON.stringify(collection, null, 2));
