const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const citizenService = require('../services/citizen.service');

const checkin = asyncHandler(async (req, res) => {
  const log = await citizenService.beatCheckin(req.user, req.body, req);
  return success(res, 201, 'Beat patrol check-in recorded', { log });
});

const list = asyncHandler(async (req, res) => {
  const logs = await citizenService.listPatrols(req.query);
  return success(res, 200, 'Beat patrol logs', { logs });
});

module.exports = { checkin, list };
