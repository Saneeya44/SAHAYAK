const auditLogModel = require('../models/auditLog.model');
const { clientIp } = require('../utils/helpers');

async function writeAudit(executor, { actorId, action, targetResource, targetId, req, details }) {
  return auditLogModel.insert(
    {
      actor_id: actorId,
      action,
      target_resource: targetResource,
      target_id: targetId || null,
      ip_address: req ? clientIp(req) : '0.0.0.0',
      details: details || {},
    },
    executor
  );
}

module.exports = { writeAudit };
