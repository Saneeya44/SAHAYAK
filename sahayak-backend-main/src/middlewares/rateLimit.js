const hits = new Map();

function rateLimit({ windowMs = 60_000, max = 80, keyPrefix = 'rl' } = {}) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = hits.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please retry shortly.' },
      });
    }
    return next();
  };
}

module.exports = { rateLimit };
