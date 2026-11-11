const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const authService = require('../services/auth.service');

const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body, req);
  return success(res, 201, 'Registration successful', data);
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body, res);
  return success(res, 200, 'Login successful', data);
});

const refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req, res);
  return success(res, 200, 'Token refreshed', data);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req);
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  return success(res, 200, 'Logged out', null);
});

const me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.user.id);
  return success(res, 200, 'Current user', data);
});

module.exports = { register, login, refresh, logout, me };
