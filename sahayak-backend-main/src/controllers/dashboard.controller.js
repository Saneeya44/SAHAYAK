const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const dashboardService = require('../services/dashboard.service');
const { runDeadManSwitch } = require('../services/deadManSwitch.service');

const overview = asyncHandler(async (_req, res) => {
  const data = await dashboardService.overview();
  return success(res, 200, 'Shirva PS-03 dashboard', data);
});

const ackAlert = asyncHandler(async (req, res) => {
  const alert = await dashboardService.acknowledgeAlert(req.params.id, req.user);
  return success(res, 200, 'Alert acknowledged', { alert });
});

const audit = asyncHandler(async (req, res) => {
  const logs = await dashboardService.listAudit(req.query.limit);
  return success(res, 200, 'Immutable audit trail', { logs });
});

const runDeadMan = asyncHandler(async (_req, res) => {
  const data = await runDeadManSwitch();
  return success(res, 200, 'Dead-man switch sweep completed', data);
});

module.exports = { overview, ackAlert, audit, runDeadMan };
