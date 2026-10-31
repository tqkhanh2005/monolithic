const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const prisma = require('./config/prisma');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      if (process.env.NODE_ENV !== 'test') console.log(JSON.stringify({ method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started })); // eslint-disable-line no-console
    });
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  if (process.env.NODE_ENV !== 'test') app.use(rateLimit({ windowMs: 60000, limit: 300 }));

  app.get('/api/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'UP', message: 'E-commerce API is running', dependencies: { postgresql: 'UP' } });
    } catch {
      res.status(503).json({ status: 'DOWN', message: 'PostgreSQL unreachable', dependencies: { postgresql: 'DOWN' } });
    }
  });
  app.use('/api/auth', require('./modules/auth'));
  app.use('/api/customers', require('./modules/customers'));
  app.use('/api/products', require('./modules/products'));
  app.use('/api/orders', require('./modules/orders'));
  app.use('/api/shipments', require('./modules/shipments'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
