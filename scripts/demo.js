require('dotenv').config();
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BASE_URL || `http://localhost:${process.env.HOST_PORT || 3002}`;
async function api(method, route, body, token) {
  const r = await fetch(base + route, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  return { status: r.status, body: await r.json() };
}
function sql(query) {
  return execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', process.env.POSTGRES_USER || 'ecommerce', '-d', process.env.POSTGRES_DB || 'ecommerce', '-Atq', '-c', query], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 30000 }).trim();
}
async function login(username, password) {
  const r = await api('POST', '/api/auth/login', { username, password }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.accessToken;
}
async function main() {
  assert.equal((await api('GET', '/api/health')).status, 200);
  const x = Number(sql('INSERT INTO "Product" (pname,price,quantity) VALUES (\'Product X\',100,10) RETURNING pid;'));
  const y = Number(sql('INSERT INTO "Product" (pname,price,quantity) VALUES (\'Product Y\',200,20) RETURNING pid;'));
  assert.ok(Number.isInteger(x) && x > 0 && Number.isInteger(y) && y > 0);
  const username = 'demo_' + randomUUID().replaceAll('-', '').slice(0, 16), password = 'P@ss12345';
  const reg = await api('POST', '/api/auth/register', { username, password }); assert.equal(reg.status, 201);
  const uid = reg.body.uid;
  const token = await login(username, password);
  const profile = await api('GET', '/api/customers/' + uid, undefined, token);
  assert.equal(profile.body.role, 'normal'); assert.equal(profile.body.membership.score, 10);
  console.log('New account: normal, score 10, uid=' + uid);
  const items = [{ pid: x, qty: 2 }, { pid: y, qty: 5 }];
  assert.equal((await api('POST', '/api/orders', { items })).status, 401);
  const order = await api('POST', '/api/orders', { items }, token); assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(order.body.total_amount, 1200);
  assert.ok(Math.abs(Date.now() - Date.parse(order.body.createdAt)) < 30000);
  const oid = order.body.oid, shipid = order.body.shipment.shipid;
  assert.equal((await api('GET', '/api/orders/' + oid, undefined, token)).status, 200);
  const staff = await login('shipper1', process.env.SEED_SHIPPER_PASSWORD || 'Shipper@123');
  const update = await api('PATCH', `/api/shipments/${shipid}/status`, { status: 'SHIPPING' }, staff); assert.equal(update.status, 200);
  assert.equal((await api('GET', '/api/shipments/' + shipid, undefined, token)).body.status, 'SHIPPING');
  assert.equal(Number(sql(`SELECT quantity FROM "Product" WHERE pid=${x}`)), 8);
  assert.equal(Number(sql(`SELECT quantity FROM "Product" WHERE pid=${y}`)), 15);
  assert.equal(sql(`SELECT status FROM "Shipment" WHERE shipid=${shipid}`), 'SHIPPING');
  const details = sql(`SELECT pid,qty FROM "OrderDetail" WHERE oid=${oid} ORDER BY pid`);
  assert.equal(details, `${x}|2\n${y}|5`);
  const summary = { result: 'PASS', uid, role: profile.body.role, score: profile.body.membership.score, oid, shipid, products: [{ pid: x, qty: 2, remaining: 8 }, { pid: y, qty: 5, remaining: 15 }], shipment: 'SHIPPING', sqlCliVerified: true };
  fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../artifacts/demo.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { sql };
