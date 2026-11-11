const { fail } = require('../utils/response');
const { isUuid } = require('../utils/helpers');

function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => {
      const value = req.body ? req.body[f] : undefined;
      return value === undefined || value === null || value === '';
    });
    if (missing.length) {
      return fail(res, 400, 'VALIDATION_ERROR', `Missing required field(s): ${missing.join(', ')}`);
    }
    return next();
  };
}

function requireUuidParam(paramName = 'id') {
  return (req, res, next) => {
    if (!isUuid(req.params[paramName])) {
      return fail(res, 400, 'VALIDATION_ERROR', `${paramName} must be a valid UUID`);
    }
    return next();
  };
}

function oneOf(field, allowed) {
  return (req, res, next) => {
    const value = req.body ? req.body[field] : undefined;
    if (value !== undefined && !allowed.includes(value)) {
      return fail(res, 400, 'VALIDATION_ERROR', `${field} must be one of: ${allowed.join(', ')}`);
    }
    return next();
  };
}

module.exports = { requireFields, requireUuidParam, oneOf };
