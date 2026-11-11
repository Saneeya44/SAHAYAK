const { fail } = require('../utils/response');
const { AppError } = require('../utils/asyncHandler');

function notFoundHandler(req, res) {
  return fail(res, 404, 'RESOURCE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} does not exist`);
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return fail(res, err.statusCode, err.code, err.message, err.data);
  }

  if (err.code === '23505') {
    return fail(res, 409, 'CONFLICT', 'Duplicate value violates a unique constraint');
  }
  if (err.code === '23503') {
    return fail(res, 400, 'VALIDATION_ERROR', 'Referenced record does not exist');
  }
  if (err.code === '22P02') {
    return fail(res, 400, 'VALIDATION_ERROR', 'Invalid identifier format');
  }

  console.error('[unhandled]', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Unexpected backend/database/integration failure');
}

module.exports = { notFoundHandler, errorHandler };
