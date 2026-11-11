const { withTransaction } = require('../config/db');
const { AppError } = require('../utils/asyncHandler');
const { generateTrackingId, isUuid } = require('../utils/helpers');
const { toNumber } = require('../utils/geo');
const constants = require('../config/constants');
const userModel = require('../models/user.model');
const incidentModel = require('../models/citizenIncident.model');
const patrolModel = require('../models/beatPatrol.model');
const seniorModel = require('../models/seniorProfile.model');
const { writeAudit } = require('./audit.service');

async function reportIncident(actor, body, req) {
  const { category, description, latitude, longitude, ward_number } = body || {};
  if (!category || !description || latitude === undefined || longitude === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'category, description, latitude and longitude are required');
  }
  if (!constants.INCIDENT_CATEGORIES.includes(category)) {
    throw new AppError(400, 'VALIDATION_ERROR', `category must be one of: ${constants.INCIDENT_CATEGORIES.join(', ')}`);
  }

  return withTransaction(async (client) => {
    const created = await incidentModel.create(
      {
        tracking_id: generateTrackingId(),
        reporter_id: actor.id,
        category,
        description,
        ward_number: ward_number ?? actor.ward_number ?? null,
        location_lat: toNumber(latitude),
        location_lng: toNumber(longitude),
      },
      client
    );
    await writeAudit(client, {
      actorId: actor.id,
      action: 'CITIZEN_INCIDENT_REPORTED',
      targetResource: 'citizen_incidents',
      targetId: created.id,
      req,
      details: { tracking_id: created.tracking_id, category },
    });
    return incidentModel.publicIncident(created);
  });
}

async function getIncident(trackingId, actor) {
  const row = await incidentModel.findByTrackingId(trackingId);
  if (!row) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Incident not found');
  const staff = [constants.ROLES.POLICE_ADMIN, constants.ROLES.WARD_AGENT].includes(actor.role);
  if (!staff && row.reporter_id !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view your own incident reports');
  }
  return incidentModel.publicIncident(row);
}

async function listIncidents(actor, query) {
  if ([constants.ROLES.POLICE_ADMIN, constants.ROLES.WARD_AGENT].includes(actor.role)) {
    return (await incidentModel.list({ status: query.status })).map(incidentModel.publicIncident);
  }
  return (await incidentModel.list({ reporter_id: actor.id, status: query.status })).map(incidentModel.publicIncident);
}

async function updateIncident(id, actor, body, req) {
  const row = isUuid(id) ? await incidentModel.findByTrackingId(id) : await incidentModel.findByTrackingId(id);
  if (!row) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Incident not found');
  return withTransaction(async (client) => {
    const updated = await incidentModel.updateStatus(
      row.id,
      {
        status: body.status,
        assigned_officer_id: body.assigned_officer_id || actor.id,
        resolution_notes: body.resolution_notes,
      },
      client
    );
    await writeAudit(client, {
      actorId: actor.id,
      action: 'CITIZEN_INCIDENT_UPDATED',
      targetResource: 'citizen_incidents',
      targetId: row.id,
      req,
      details: { status: body.status },
    });
    return incidentModel.publicIncident(updated);
  });
}

async function beatCheckin(actor, body, req) {
  const { senior_id, condition_ok, notes, latitude, longitude } = body || {};
  if (!senior_id) throw new AppError(400, 'VALIDATION_ERROR', 'senior_id is required');
  const senior = await seniorModel.findByUserId(senior_id);
  if (!senior) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Senior profile not found');

  const officer = await userModel.findById(actor.id);

  return withTransaction(async (client) => {
    const created = await patrolModel.create(
      {
        senior_id,
        officer_id: actor.id,
        ward_number: actor.ward_number || senior.ward_number,
        condition_ok: condition_ok !== false,
        notes,
        checkin_lat: toNumber(latitude),
        checkin_lng: toNumber(longitude),
      },
      client
    );
    await writeAudit(client, {
      actorId: actor.id,
      action: 'BEAT_PATROL_CHECKIN',
      targetResource: 'beat_patrol_logs',
      targetId: created.id,
      req,
      details: { senior_id, condition_ok: created.condition_ok },
    });
    return patrolModel.publicPatrol({
      ...created,
      senior_name: senior.full_name,
      officer_name: officer?.full_name,
    });
  });
}

async function listPatrols(query) {
  return (await patrolModel.list({ senior_id: query.senior_id, today: query.today === 'true' })).map(
    patrolModel.publicPatrol
  );
}

module.exports = {
  reportIncident,
  getIncident,
  listIncidents,
  updateIncident,
  beatCheckin,
  listPatrols,
};
