const express = require('express');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { HttpError, wrap } = require('../middleware/errors');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const parseId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'shipid must be a positive integer');
  return n;
};
const statusSchema = z.object({ status: z.enum(['PENDING', 'SHIPPING', 'DELIVERED', 'CANCELLED']) }).strict();

router.get('/:shipid', wrap(async (req, res) => {
  const s = await prisma.shipment.findUnique({ where: { shipid: parseId(req.params.shipid) }, include: { order: true } });
  if (!s) throw new HttpError(404, 'Shipment not found');
  if (req.user.role === 'CUSTOMER' && s.order.uid !== req.user.uid) throw new HttpError(403, 'Forbidden');
  res.json({ shipid: s.shipid, oid: s.oid, status: s.status });
}));

router.patch('/:shipid/status', authorize('ADMIN', 'SHIPMENT_STAFF'), wrap(async (req, res) => {
  const shipid = parseId(req.params.shipid);
  const { status } = statusSchema.parse(req.body);
  if (!(await prisma.shipment.findUnique({ where: { shipid } }))) throw new HttpError(404, 'Shipment not found');
  const s = await prisma.shipment.update({ where: { shipid }, data: { status } });
  res.json({ shipid: s.shipid, oid: s.oid, status: s.status });
}));

module.exports = router;
