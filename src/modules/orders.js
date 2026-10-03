const express = require('express');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { HttpError, wrap } = require('../middleware/errors');
const { authenticate } = require('../middleware/auth');
const { discountPercentForScore, computeTotals } = require('../utils/discount');

const router = express.Router();
router.use(authenticate);

// Client sends ONLY pid+qty. Prices/discount/total are never accepted from the client.
const createSchema = z.object({
  items: z.array(z.object({ pid: z.number().int().positive(), qty: z.number().int().positive().max(10000) }).strict()).min(1).max(100),
}).strict();

const fmtOrder = (o) => {
  const items = o.details.map((d) => ({ pid: d.pid, qty: d.qty, unit_price: Number(d.unit_price) }));
  const discount = Number(o.discount);
  return {
    oid: o.oid, uid: o.uid, discount, createdAt: o.createdAt, items,
    total_amount: computeTotals(items, discount).total,
    ...(o.shipments ? { shipment: o.shipments[0] ? { shipid: o.shipments[0].shipid, status: o.shipments[0].status } : null } : {}),
  };
};
const include = { details: { orderBy: { pid: 'asc' } }, shipments: true };

router.post('/', wrap(async (req, res) => {
  const { items } = createSchema.parse(req.body);
  const merged = new Map();
  for (const i of items) merged.set(i.pid, (merged.get(i.pid) || 0) + i.qty);

  const order = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { uid: req.user.uid }, include: { member: true } });
    if (!user) throw new HttpError(404, 'Customer not found');
    const percent = discountPercentForScore(user.member.score);

    // Atomic conditional decrement: cannot oversell even under concurrent orders.
    for (const [pid, qty] of merged) {
      const r = await tx.product.updateMany({ where: { pid, quantity: { gte: qty } }, data: { quantity: { decrement: qty } } });
      if (r.count === 0) {
        const exists = await tx.product.findUnique({ where: { pid } });
        throw new HttpError(exists ? 409 : 404, exists ? `Insufficient stock for product ${pid}` : `Product ${pid} not found`);
      }
    }
    const products = await tx.product.findMany({ where: { pid: { in: [...merged.keys()] } } });
    const created = await tx.order.create({
      data: {
        uid: user.uid,
        discount: percent,
        details: { create: products.map((p) => ({ pid: p.pid, qty: merged.get(p.pid), unit_price: p.price })) },
        shipments: { create: { status: 'PENDING' } },
      },
      include,
    });
    return created;
  });
  res.status(201).json(fmtOrder(order));
}));

router.get('/', wrap(async (req, res) => {
  const where = req.user.role === 'ADMIN' ? {} : { uid: req.user.uid };
  const orders = await prisma.order.findMany({ where, include, orderBy: { oid: 'asc' } });
  res.json({ items: orders.map(fmtOrder) });
}));

router.get('/:oid', wrap(async (req, res) => {
  const oid = Number(req.params.oid);
  if (!Number.isInteger(oid) || oid < 1) throw new HttpError(400, 'oid must be a positive integer');
  const o = await prisma.order.findUnique({ where: { oid }, include });
  if (!o) throw new HttpError(404, 'Order not found');
  if (req.user.role !== 'ADMIN' && o.uid !== req.user.uid) throw new HttpError(403, 'Forbidden');
  res.json(fmtOrder(o));
}));

module.exports = router;
