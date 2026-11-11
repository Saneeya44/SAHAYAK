const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, phone_number: user.phone_number, typ: 'access' },
    env.jwtSecret,
    { expiresIn: env.jwtAccessExpiresIn, algorithm: 'HS256' }
  );
}

function signRefreshToken(user, sessionId) {
  return jwt.sign(
    { userId: user.id, role: user.role, sid: sessionId, typ: 'refresh' },
    env.jwtSecret,
    { expiresIn: env.jwtRefreshExpiresIn, algorithm: 'HS256' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function randomId() {
  return crypto.randomUUID();
}

function hmacSha256(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  hashToken,
  randomId,
  hmacSha256,
  timingSafeEqual,
};
