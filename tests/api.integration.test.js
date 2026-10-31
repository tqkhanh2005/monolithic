// Integration tests: real Express app + real PostgreSQL (DATABASE_URL). No mocks.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');
const { createApp } = require('../src/app');

const app = createApp();
const suffix = Date.now().toString(36);
let admin, cust, shipper, pid1, pid2;

async function login(username, password) {
  const r = await request(app).post('/api/auth/login').send({ username, password });
  return r.body.accessToken;
}
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  if (!/^ecommerce_test(?:_[a-z0-9]+)?$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Use a separate ecommerce_test database');
  const seed = require('child_process');
  seed.execSync('node prisma/seed.js', { env: process.env, stdio: 'ignore' });
  admin = await login('admin', process.env.SEED_ADMIN_PASSWORD || 'Admin@123');
  cust = await login('customer1', process.env.SEED_CUSTOMER_PASSWORD || 'Customer@123');
  shipper = await login('shipper1', process.env.SEED_SHIPPER_PASSWORD || 'Shipper@123');
  pid1 = (await request(app).post('/api/products').set(bearer(admin)).send({ pname: `IT-A-${suffix}`, price: 100, quantity: 5 })).body.pid;
  pid2 = (await request(app).post('/api/products').set(bearer(admin)).send({ pname: `IT-B-${suffix}`, price: 20.5, quantity: 3 })).body.pid;
});
afterAll(() => prisma.$disconnect());

describe('health', () => {
  it('UP with real DB', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('UP');
  });
});

describe('auth (TC-IAM-01..05)', () => {
  const u = `user_${suffix}`;
  it('registers -> 201 and stores a bcrypt hash', async () => {
    const r = await request(app).post('/api/auth/register').send({ username: u, password: 'P@ss123', email: `${u}@x.com` });
    expect(r.status).toBe(201);
    const row = await prisma.user.findUnique({ where: { username: u }, include: { role: true, member: true } });
    expect(row.password).not.toBe('P@ss123');
    expect(await bcrypt.compare('P@ss123', row.password)).toBe(true);
    expect(row.role.rolename).toBe('normal');
    expect(row.member.score).toBe(10);
  });
  it('duplicate username -> 409', async () => {
    expect((await request(app).post('/api/auth/register').send({ username: u, password: 'P@ss123' })).status).toBe(409);
  });
  it('missing password -> 400', async () => {
    expect((await request(app).post('/api/auth/register').send({ username: `x${suffix}`, password: '' })).status).toBe(400);
  });
  it('login ok -> JWT with sub and role', async () => {
    const r = await request(app).post('/api/auth/login').send({ username: u, password: 'P@ss123' });
    expect(r.status).toBe(200);
    const p = jwt.decode(r.body.accessToken);
    expect(p.role).toBe('normal');
    expect(p.sub).toBeDefined();
  });
  it('wrong password -> 401', async () => {
    expect((await request(app).post('/api/auth/login').send({ username: u, password: 'bad' })).status).toBe(401);
  });
  it('mass assignment: role/mid in register body is rejected or ignored', async () => {
    const name = `ma_${suffix}`;
    await request(app).post('/api/auth/register').send({ username: name, password: 'P@ss123', roleid: 1, role: 'ADMIN', mid: 4 });
    const row = await prisma.user.findUnique({ where: { username: name }, include: { role: true } });
    expect(row.role.rolename).toBe('normal');
    expect(row.mid).not.toBe(4);
  });
});

describe('security', () => {
  it('no token -> 401', async () => expect((await request(app).get('/api/products')).status).toBe(401));
  it('garbage token -> 401', async () => expect((await request(app).get('/api/products').set(bearer('abc.def.ghi'))).status).toBe(401));
  it('expired token -> 401', async () => {
    const t = jwt.sign({ sub: '1', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: -10 });
    expect((await request(app).get('/api/products').set(bearer(t))).status).toBe(401);
  });
  it('token signed with wrong secret -> 401', async () => {
    const t = jwt.sign({ sub: '1', role: 'ADMIN' }, 'other-secret');
    expect((await request(app).get('/api/products').set(bearer(t))).status).toBe(401);
  });
  it('alg=none token -> 401', async () => {
    const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const t = `${b({ alg: 'none', typ: 'JWT' })}.${b({ sub: '1', role: 'ADMIN' })}.`;
    expect((await request(app).get('/api/products').set(bearer(t))).status).toBe(401);
  });
  it('customer creating product -> 403', async () => {
    expect((await request(app).post('/api/products').set(bearer(cust)).send({ pname: 'x', price: 1, quantity: 1 })).status).toBe(403);
  });
  it('SQL injection in login/pid does not bypass or crash', async () => {
    expect((await request(app).post('/api/auth/login').send({ username: "admin' OR '1'='1", password: "x' OR '1'='1" })).status).toBe(401);
    expect((await request(app).get("/api/products/1;DROP TABLE \"Product\"").set(bearer(cust))).status).toBe(400);
    expect((await prisma.product.count()) > 0).toBe(true);
  });
  it('customer cannot read another customer / order', async () => {
    const admRow = await prisma.user.findUnique({ where: { username: 'admin' } });
    expect((await request(app).get(`/api/customers/${admRow.uid}`).set(bearer(cust))).status).toBe(403);
  });
  it('malformed JSON -> 400', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(r.status).toBe(400);
  });
});

describe('products (TC-PRO)', () => {
  it('list / get / 404', async () => {
    expect((await request(app).get('/api/products').set(bearer(cust))).body.items.length).toBeGreaterThan(0);
    expect((await request(app).get(`/api/products/${pid1}`).set(bearer(cust))).body.pname).toBe(`IT-A-${suffix}`);
    expect((await request(app).get('/api/products/99999999').set(bearer(cust))).status).toBe(404);
  });
  it('update stock exactly', async () => {
    const p = (await request(app).post('/api/products').set(bearer(admin)).send({ pname: `S-${suffix}`, price: 1, quantity: 7 })).body.pid;
    expect((await request(app).put(`/api/products/${p}`).set(bearer(admin)).send({ quantity: 42 })).status).toBe(200);
    expect((await request(app).get(`/api/products/${p}`).set(bearer(admin))).body.quantity).toBe(42);
  });
  it('invalid data -> 400', async () => {
    expect((await request(app).post('/api/products').set(bearer(admin)).send({ pname: 'x', price: -1, quantity: 1 })).status).toBe(400);
  });
});

describe('orders (TC-ORD, FR07-FR10)', () => {
  it('creates order using server prices, discount by score, decrements stock, creates PENDING shipment', async () => {
    // customer1 is Silver (score 100) -> 5%
    const r = await request(app).post('/api/orders').set(bearer(cust)).send({ items: [{ pid: pid1, qty: 2 }, { pid: pid2, qty: 1 }] });
    expect(r.status).toBe(201);
    expect(r.body.discount).toBe(5);
    expect(r.body.items).toEqual([{ pid: pid1, qty: 2, unit_price: 100 }, { pid: pid2, qty: 1, unit_price: 20.5 }]);
    expect(r.body.total_amount).toBe(209.47); // (200+20.5)=220.5 - 5% = 209.475 -> subtotal-discountAmount
    expect(r.body.shipment.status).toBe('PENDING');
    expect((await prisma.product.findUnique({ where: { pid: pid1 } })).quantity).toBe(3);
    expect((await prisma.orderDetail.count({ where: { oid: r.body.oid } }))).toBe(2);
  });
  it('client-supplied price/total/discount are rejected (strict schema)', async () => {
    const r = await request(app).post('/api/orders').set(bearer(cust)).send({ items: [{ pid: pid1, qty: 1, unit_price: 0.01 }], discount: 99, total: 1 });
    expect(r.status).toBe(400);
  });
  it('no token -> 401', async () => expect((await request(app).post('/api/orders').send({ items: [{ pid: pid1, qty: 1 }] })).status).toBe(401));
  it('insufficient stock -> 409 and nothing changes (rollback)', async () => {
    const before = (await prisma.product.findUnique({ where: { pid: pid2 } })).quantity;
    const r = await request(app).post('/api/orders').set(bearer(cust)).send({ items: [{ pid: pid1, qty: 1 }, { pid: pid2, qty: before + 1 }] });
    expect(r.status).toBe(409);
    expect((await prisma.product.findUnique({ where: { pid: pid2 } })).quantity).toBe(before);
    expect((await prisma.product.findUnique({ where: { pid: pid1 } })).quantity).toBe(3); // first item's decrement rolled back
  });
  it('unknown product -> 404', async () => {
    expect((await request(app).post('/api/orders').set(bearer(cust)).send({ items: [{ pid: 99999999, qty: 1 }] })).status).toBe(404);
  });
  it('concurrent orders cannot oversell', async () => {
    const p = (await request(app).post('/api/products').set(bearer(admin)).send({ pname: `C-${suffix}`, price: 5, quantity: 3 })).body.pid;
    const rs = await Promise.all(Array.from({ length: 6 }, () => request(app).post('/api/orders').set(bearer(cust)).send({ items: [{ pid: p, qty: 1 }] })));
    expect(rs.filter((r) => r.status === 201).length).toBe(3);
    expect(rs.filter((r) => r.status === 409).length).toBe(3);
    expect((await prisma.product.findUnique({ where: { pid: p } })).quantity).toBe(0);
  });
  it('customer sees only own orders; other customer gets 403 on someone else\'s order', async () => {
    const list = await request(app).get('/api/orders').set(bearer(cust));
    expect(list.status).toBe(200);
    const other = `oth_${suffix}`;
    await request(app).post('/api/auth/register').send({ username: other, password: 'P@ss123' });
    const t = await login(other, 'P@ss123');
    expect((await request(app).get(`/api/orders/${list.body.items[0].oid}`).set(bearer(t))).status).toBe(403);
    expect((await request(app).get(`/api/orders/${list.body.items[0].oid}`).set(bearer(cust))).status).toBe(200);
    expect((await request(app).get('/api/orders/99999999').set(bearer(cust))).status).toBe(404);
  });
});

describe('shipments (TC-SHP-03/04, FR11-12)', () => {
  it('staff updates status; customer cannot; 404; invalid status 400', async () => {
    const o = (await request(app).get('/api/orders').set(bearer(cust))).body.items[0];
    const shipid = o.shipment.shipid;
    expect((await request(app).patch(`/api/shipments/${shipid}/status`).set(bearer(cust)).send({ status: 'SHIPPING' })).status).toBe(403);
    const ok = await request(app).patch(`/api/shipments/${shipid}/status`).set(bearer(shipper)).send({ status: 'SHIPPING' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('SHIPPING');
    expect((await request(app).patch(`/api/shipments/${shipid}/status`).set(bearer(shipper)).send({ status: 'FLYING' })).status).toBe(400);
    expect((await request(app).patch('/api/shipments/99999999/status').set(bearer(shipper)).send({ status: 'SHIPPING' })).status).toBe(404);
    expect((await request(app).get(`/api/shipments/${shipid}`).set(bearer(cust))).body.status).toBe('SHIPPING');
  });
});

describe('customers (TC-CUS)', () => {
  it('get own customer + membership; update fullname; cannot self-upgrade membership', async () => {
    const uid = Number(jwt.decode(cust).sub);
    const g = await request(app).get(`/api/customers/${uid}`).set(bearer(cust));
    expect(g.status).toBe(200);
    expect(g.body.membership).toHaveProperty('score');
    expect((await request(app).put(`/api/customers/${uid}`).set(bearer(cust)).send({ fullname: 'John Smith' })).status).toBe(200);
    expect((await request(app).put(`/api/customers/${uid}`).set(bearer(cust)).send({ mid: 4 })).status).toBe(403);
    expect((await request(app).get('/api/customers/99999999').set(bearer(admin))).status).toBe(404);
    expect((await request(app).get(`/api/customers/${uid}`)).status).toBe(401);
  });
});
