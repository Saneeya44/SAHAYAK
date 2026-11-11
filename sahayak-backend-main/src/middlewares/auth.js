const env = require('../config/env');
const { fail } = require('../utils/response');
const { verifyToken } = require('../utils/jwt');
const userModel = require('../models/user.model');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Missing or invalid Authorization header');
  }

  try {
    const payload = verifyToken(token);
    if (payload.typ && payload.typ !== 'access') {
      return fail(res, 401, 'UNAUTHENTICATED', 'Access token required');
    }
    req.user = {
      id: payload.userId,
      role: payload.role,
      phone_number: payload.phone_number,
    };
    return next();
  } catch (_err) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Invalid or expired token');
  }
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyToken(token);
      req.user = { id: payload.userId, role: payload.role, phone_number: payload.phone_number };
    } catch (_err) {
      /* ignore */
    }
  }
  next();
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, 'FORBIDDEN', `Requires role: ${roles.join(' or ')}`);
    }
    return next();
  };
}

async function attachActiveUser(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user || user.is_active === false) {
      return fail(res, 401, 'UNAUTHENTICATED', 'Account is inactive');
    }
    req.account = user;
    next();
  } catch (err) {
    next(err);
  }
}

function verifyWebhookSignature(req, res, next) {
  const provided =
    req.headers['x-sahayak-signature'] ||
    req.headers['x-webhook-secret'] ||
    req.query.secret;
  if (!provided || String(provided) !== env.webhookSigningSecret) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Invalid webhook signature');
  }
  return next();
}

module.exports = {
  authenticate,
  optionalAuth,
  requireRoles,
  attachActiveUser,
  verifyWebhookSignature,
};
