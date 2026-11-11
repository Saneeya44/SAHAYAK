function success(res, statusCode, message, data = null) {
  const payload = { success: true, message };
  if (data !== null && data !== undefined) payload.data = data;
  return res.status(statusCode).json(payload);
}

function fail(res, statusCode, code, message, extra) {
  const body = {
    success: false,
    error: { code, message },
  };
  if (extra !== undefined) body.data = extra;
  return res.status(statusCode).json(body);
}

module.exports = { success, fail };
