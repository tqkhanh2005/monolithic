const express = require('express');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { HttpError, wrap } = require('../middleware/errors');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const fmt = (p) => ({ pid: p.pid, pname: p.pname, price: Number(p.price), quantity: p.quantity });
const parsePid = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'pid must be a positive integer');
  return n;
};
const createSchema = z.object({
  pname: z.string().trim().min(1).max(100),
  price: z.number().nonnegative().max(99999999),
  quantity: z.number().int().nonnegative(),
}).strict();
const updateSchema = createSchema.partial().strict();

router.get('/', wrap(async (req, res) => {
  const items = await prisma.product.findMany({ orderBy: { pid: 'asc' } });
  res.json({ items: items.map(fmt) });
}));

router.get('/:pid', wrap(async (req, res) => {
  const p = await prisma.product.findUnique({ where: { pid: parsePid(req.params.pid) } });
  if (!p) throw new HttpError(404, 'Product not found');
  res.json(fmt(p));
}));

router.post('/', authorize('ADMIN'), wrap(async (req, res) => {
  const p = await prisma.product.create({ data: createSchema.parse(req.body) });
  res.status(201).json(fmt(p));
}));

router.put('/:pid', authorize('ADMIN'), wrap(async (req, res) => {
  const pid = parsePid(req.params.pid);
  const data = updateSchema.parse(req.body);
  if (!(await prisma.product.findUnique({ where: { pid } }))) throw new HttpError(404, 'Product not found');
  await prisma.product.update({ where: { pid }, data });
  res.json({ message: 'Product updated successfully', pid });
}));

router.delete('/:pid', authorize('ADMIN'), wrap(async (req, res) => {
  const pid = parsePid(req.params.pid);
  if (!(await prisma.product.findUnique({ where: { pid } }))) throw new HttpError(404, 'Product not found');
  if (await prisma.orderDetail.count({ where: { pid } })) throw new HttpError(409, 'Product is referenced by existing orders');
  await prisma.product.delete({ where: { pid } });
  res.json({ message: 'Product deleted successfully', pid });
}));

module.exports = router;
