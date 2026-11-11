const constants = require('../config/constants');
const requestModel = require('../models/serviceRequest.model');
const policeAlertModel = require('../models/policeAlert.model');
const { writeAudit } = require('./audit.service');
const volunteerService = require('./volunteer.service');
const { withTransaction } = require('../config/db');

async function runDeadManSwitch() {
  return withTransaction(async (client) => {
    const stale = await requestModel.revertStaleAssignments(constants.DEAD_MAN_SWITCH_MINUTES, client);
    const results = [];

    for (const row of stale) {
      const volunteerId = row.previous_volunteer_id;
      if (volunteerId) {
        await volunteerService.applyTrustPenalty(volunteerId, client);
      }
      await policeAlertModel.create(
        {
          alert_type: 'DEAD_MAN_SWITCH',
          severity: 'HIGH',
          title: 'Volunteer inactivity — request reverted to PENDING',
          message: `Request ${row.id} reverted after ${constants.DEAD_MAN_SWITCH_MINUTES} minutes with no progress. Trust -${constants.TRUST_PENALTY}.`,
          related_request_id: row.id,
          related_user_id: volunteerId,
        },
        client
      );
      await writeAudit(client, {
        actorId: row.senior_id,
        action: 'DEAD_MAN_SWITCH_REVERT',
        targetResource: 'service_requests',
        targetId: row.id,
        details: {
          previous_volunteer: volunteerId,
          trust_penalty: constants.TRUST_PENALTY,
        },
      });
      results.push({ request_id: row.id, status: 'PENDING' });
    }

    return { reverted: results.length, requests: results };
  });
}

function startDeadManLoop() {
  const timer = setInterval(() => {
    runDeadManSwitch().catch((err) => console.error('[dead-man-switch]', err.message));
  }, 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = { runDeadManSwitch, startDeadManLoop };
