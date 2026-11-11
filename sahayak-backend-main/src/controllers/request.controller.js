const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const requestService = require('../services/request.service');
const emergencyService = require('../services/emergency.service');

const create = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(req.user, req.body, req);
  return success(res, 201, 'Service request created', { request });
});

const list = asyncHandler(async (req, res) => {
  const requests = await requestService.listRequests(req.user, req.query);
  return success(res, 200, 'Service requests', { requests });
});

const getOne = asyncHandler(async (req, res) => {
  const request = await requestService.getRequest(req.params.id);
  return success(res, 200, 'Service request', { request });
});

const accept = asyncHandler(async (req, res) => {
  const data = await requestService.acceptRequest(req.user, req.params.id, req.body?.version, req);
  return success(res, 200, 'Service request assigned', data);
});

const start = asyncHandler(async (req, res) => {
  const request = await requestService.progressRequest(req.user, req.params.id, 'IN_PROGRESS', req);
  return success(res, 200, 'Request marked IN_PROGRESS', { request });
});

const complete = asyncHandler(async (req, res) => {
  const request = await requestService.progressRequest(req.user, req.params.id, 'COMPLETED', req);
  return success(res, 200, 'Request completed', { request });
});

const cancel = asyncHandler(async (req, res) => {
  const request = await requestService.progressRequest(req.user, req.params.id, 'CANCELLED', req);
  return success(res, 200, 'Request cancelled', { request });
});

const escalate = asyncHandler(async (req, res) => {
  const data = await emergencyService.escalate({
    actor: req.user,
    requestId: req.params.id,
    body: req.body,
    req,
  });
  return success(res, 201, 'Emergency escalated to 112 path', data);
});

const sos = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(
    req.user,
    { ...req.body, is_sos: true, category: req.body.category || 'SOS_MEDICAL' },
    req
  );
  const data = await emergencyService.escalate({
    actor: req.user,
    requestId: request.id,
    body: {
      reason: req.body.description || req.body.reason || 'Senior citizen SOS',
      escalation_source: 'APP',
      idempotency_key: req.body.idempotency_key ? `${req.body.idempotency_key}-sos` : undefined,
      threat_flag: 'HIGH_CRITICAL_RED',
    },
    req,
  });
  return success(res, 201, 'SOS accepted and escalated', { request, emergency: data });
});

module.exports = { create, list, getOne, accept, start, complete, cancel, escalate, sos };
