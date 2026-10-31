require('dotenv').config();
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
async function main() {
  const target = new URL(process.env.DATABASE_URL);
  const database = target.pathname.slice(1);
  if (!/^ecommerce_test(?:_[a-z0-9]+)?$/.test(database)) throw new Error('Integration tests require a separate ecommerce_test database');
  const adminUrl = new URL(target); adminUrl.pathname = '/postgres'; adminUrl.search = '';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) await admin.query(`CREATE DATABASE "${database}"`);
  } finally { await admin.end(); }
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error('Test database migration failed');
  const seed = spawnSync(process.execPath, ['prisma/seed.js'], { stdio: 'inherit', env: process.env });
  if (seed.status !== 0) throw new Error('Test database seed failed');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
