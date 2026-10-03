const { ZodError } = require('zod');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.originalUrl} not found` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Bad Request', message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad Request', message: 'Malformed JSON' });
  if (err.code === 'P2002') return res.status(409).json({ error: 'Conflict', message: 'Duplicate value' });
  // eslint-disable-next-line no-console
  console.error('[unhandled]', err.message);
  return res.status(500).json({ error: 'Internal Server Error' });
}

module.exports = { HttpError, wrap, notFound, errorHandler };
