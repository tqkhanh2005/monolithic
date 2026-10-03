const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { HttpError } = require('./errors');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'Missing or malformed Authorization header'));
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    req.user = { uid: Number(payload.sub), role: payload.role };
    return next();
  } catch (e) {
    return next(new HttpError(401, e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
  }
}

const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden: insufficient role'));

module.exports = { authenticate, authorize };
