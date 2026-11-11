const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { incidentContext } = require('../services/incidentContext.service');
const citizenService = require('../services/citizen.service');

const context = asyncHandler(async (req, res) => {
  const data = await incidentContext(req.params.id);
  return success(res, 200, 'Incident investigation context', data);
});

const report = asyncHandler(async (req, res) => {
  const incident = await citizenService.reportIncident(req.user, req.body, req);
  return success(res, 201, 'Incident reported', { incident });
});

const getOne = asyncHandler(async (req, res) => {
  const incident = await citizenService.getIncident(req.params.trackingId, req.user);
  return success(res, 200, 'Incident', { incident });
});

const list = asyncHandler(async (req, res) => {
  const incidents = await citizenService.listIncidents(req.user, req.query);
  return success(res, 200, 'Citizen incidents', { incidents });
});

const update = asyncHandler(async (req, res) => {
  const incident = await citizenService.updateIncident(req.params.trackingId, req.user, req.body, req);
  return success(res, 200, 'Incident updated', { incident });
});

module.exports = { context, report, getOne, list, update };
