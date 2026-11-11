const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const emergencyService = require('../services/emergency.service');
const voiceService = require('../services/voice.service');

const list = asyncHandler(async (req, res) => {
  const logs = await emergencyService.listEmergencies(req.query);
  return success(res, 200, 'Emergency 112 logs', { logs });
});

const acknowledge = asyncHandler(async (req, res) => {
  const log = await emergencyService.acknowledgeEmergency(req.params.id, req.user, req);
  return success(res, 200, 'Emergency acknowledged', { log });
});

const inboundWebhook = asyncHandler(async (req, res) => {
  const data = await voiceService.handleInbound(req.body, req);
  return success(res, 201, 'Voice/IVR event processed', data);
});

module.exports = { list, acknowledge, inboundWebhook };
