const { query } = require('../config/db');
const emergencyModel = require('../models/emergency112.model');
const policeAlertModel = require('../models/policeAlert.model');
const patrolModel = require('../models/beatPatrol.model');
const incidentModel = require('../models/citizenIncident.model');
const requestModel = require('../models/serviceRequest.model');
const volunteerModel = require('../models/volunteerProfile.model');
const { AppError } = require('../utils/asyncHandler');

async function overview() {
  const [pending, assigned, sos, inProgress, escalated] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n FROM service_requests WHERE status = 'PENDING'`),
    query(`SELECT COUNT(*)::int AS n FROM service_requests WHERE status = 'ASSIGNED'`),
    query(`SELECT COUNT(*)::int AS n FROM service_requests WHERE category LIKE 'SOS%'`),
    query(`SELECT COUNT(*)::int AS n FROM service_requests WHERE status = 'IN_PROGRESS'`),
    query(`SELECT COUNT(*)::int AS n FROM service_requests WHERE status IN ('ESCALATED_112', 'POLICE_DISPATCHED')`),
  ]);

  const [volRegistered, volReview, volVerified] = await Promise.all([
    volunteerModel.list({ status: 'REGISTERED' }),
    volunteerModel.list({ status: 'UNDER_REVIEW' }),
    volunteerModel.list({ status: 'VERIFIED' }),
  ]);

  const sosQueue = await emergencyModel.listUnacked();
  const alerts = await policeAlertModel.listUnacked();
  const patrolsToday = await patrolModel.list({ today: true });
  const openIncidents = await incidentModel.list({ status: 'OPEN' });
  const pendingRequests = await requestModel.list({ status: 'PENDING' });

  return {
    station: { id: 'PS-03-SHIRVA', name: 'Shirva Police Station', district: 'Udupi' },
    kpis: {
      pending_citizen_requests: pending.rows[0].n,
      assigned_requests: assigned.rows[0].n,
      in_progress_requests: inProgress.rows[0].n,
      sos_records: sos.rows[0].n,
      escalated_112: escalated.rows[0].n,
      unacked_112_queue: sosQueue.length,
      unacked_police_alerts: alerts.length,
      open_citizen_incidents: openIncidents.length,
      beat_patrols_today: patrolsToday.length,
      volunteers_registered: volRegistered.length,
      volunteers_under_review: volReview.length,
      volunteers_verified: volVerified.length,
    },
    sos_queue: sosQueue.map(emergencyModel.publicEmergency),
    police_alerts: alerts,
    active_patrol_logs: patrolsToday.map(patrolModel.publicPatrol),
    pending_citizen_requests: pendingRequests.map(requestModel.publicRequest),
    pending_incidents: openIncidents.map(incidentModel.publicIncident),
  };
}

async function acknowledgeAlert(id, actor) {
  const updated = await policeAlertModel.acknowledge(id, actor.id, { query });
  if (!updated) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Alert not found');
  return updated;
}

async function listAudit(limit) {
  const auditLogModel = require('../models/auditLog.model');
  return auditLogModel.list({ limit: Number(limit) || 100 });
}

module.exports = { overview, acknowledgeAlert, listAudit };
