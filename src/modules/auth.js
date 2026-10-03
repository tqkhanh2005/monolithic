const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { HttpError, wrap } = require('../middleware/errors');

const router = express.Router();

// Mass-assignment protection: only these fields are read; role/mid can never be set by the client.
const registerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(72),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(30).optional(),
  fullname: z.string().trim().max(100).optional(),
});
const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

router.post('/register', wrap(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const [role, member] = await Promise.all([
    prisma.role.findUnique({ where: { rolename: 'CUSTOMER' } }),
    prisma.memberShip.findFirst({ orderBy: { score: 'asc' } }),
  ]);
  if (!role || !member) throw new HttpError(500, 'System not seeded');

  const dup = await prisma.user.findFirst({
    where: { OR: [{ username: body.username }, ...(body.email ? [{ email: body.email }] : [])] },
  });
  if (dup) throw new HttpError(409, 'Username or email already exists');

  const user = await prisma.user.create({
    data: { ...body, password: await bcrypt.hash(body.password, env.bcryptRounds), roleid: role.roleid, mid: member.mid },
  });
  res.status(201).json({ message: 'User registered successfully', uid: user.uid });
}));

router.post('/login', wrap(async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { username }, include: { role: true } });
  // Same generic error for unknown user / wrong password (no user enumeration).
  const ok = user && (await bcrypt.compare(password, user.password));
  if (!ok) throw new HttpError(401, 'Invalid username or password');
  const accessToken = jwt.sign({ sub: String(user.uid), role: user.role.rolename }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn,
  });
  res.json({ accessToken, tokenType: 'Bearer', expiresIn: env.jwtExpiresIn });
}));

module.exports = router;
