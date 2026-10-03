const express = require('express');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { HttpError, wrap } = require('../middleware/errors');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Owner-or-admin: a customer can never read/modify another customer's data.
function assertAccess(req, uid) {
  if (req.user.role !== 'ADMIN' && req.user.uid !== uid) throw new HttpError(403, 'Forbidden');
}
const parseUid = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'uid must be a positive integer');
  return n;
};

router.get('/:uid', wrap(async (req, res) => {
  const uid = parseUid(req.params.uid);
  assertAccess(req, uid);
  const u = await prisma.user.findUnique({ where: { uid }, include: { member: true } });
  if (!u) throw new HttpError(404, 'Customer not found');
  res.json({ uid: u.uid, fullname: u.fullname, mid: u.mid, membership: { mname: u.member.mname, score: u.member.score } });
}));

const updateSchema = z.object({ fullname: z.string().trim().min(1).max(100).optional(), mid: z.number().int().positive().optional() }).strict();

router.put('/:uid', wrap(async (req, res) => {
  const uid = parseUid(req.params.uid);
  assertAccess(req, uid);
  const data = updateSchema.parse(req.body);
  // Changing membership tier is a privileged operation (it drives discount).
  if (data.mid !== undefined && req.user.role !== 'ADMIN') throw new HttpError(403, 'Only admin can change membership');
  if (data.mid !== undefined && !(await prisma.memberShip.findUnique({ where: { mid: data.mid } }))) throw new HttpError(400, 'Unknown membership');
  const exists = await prisma.user.findUnique({ where: { uid } });
  if (!exists) throw new HttpError(404, 'Customer not found');
  await prisma.user.update({ where: { uid }, data });
  res.json({ message: 'Customer updated successfully', uid });
}));

module.exports = router;
