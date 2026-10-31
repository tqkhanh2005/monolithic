// Idempotent seed. Demo credentials come from env (SEED_*_PASSWORD) with dev-only defaults.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function main() {
  const roles = {};
  for (const rolename of ['ADMIN', 'normal', 'SHIPMENT_STAFF']) {
    roles[rolename] = await prisma.role.upsert({ where: { rolename }, update: {}, create: { rolename } });
  }
  const tiers = [['Standard', 10], ['Silver', 100], ['Gold', 500], ['Platinum', 1000]];
  const members = {};
  for (const [mname, score] of tiers) {
    members[mname] = await prisma.memberShip.upsert({ where: { mname }, update: { score }, create: { mname, score } });
  }
  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
  const users = [
    ['admin', 'ADMIN', 'Standard', process.env.SEED_ADMIN_PASSWORD || 'Admin@123'],
    ['customer1', 'normal', 'Silver', process.env.SEED_CUSTOMER_PASSWORD || 'Customer@123'],
    ['shipper1', 'SHIPMENT_STAFF', 'Standard', process.env.SEED_SHIPPER_PASSWORD || 'Shipper@123'],
  ];
  for (const [username, role, tier, pw] of users) {
    await prisma.user.upsert({
      where: { username },
      update: { roleid: roles[role].roleid },
      create: { username, fullname: username, email: `${username}@example.com`, password: await bcrypt.hash(pw, rounds), roleid: roles[role].roleid, mid: members[tier].mid },
    });
  }
  if ((await prisma.product.count()) === 0) {
    await prisma.product.createMany({ data: [
      { pname: 'Laptop', price: 1500, quantity: 10 },
      { pname: 'Mouse', price: 25, quantity: 100 },
      { pname: 'Keyboard', price: 45, quantity: 50 },
    ] });
  }
  console.log('Seed complete');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
