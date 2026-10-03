const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const url = new URL(process.env.DATABASE_URL);
const schema = url.searchParams.get('schema') || 'public';
url.searchParams.delete('schema');

const adapter = new PrismaPg({ connectionString: url.toString() }, { schema });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
