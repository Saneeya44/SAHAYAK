const { withTransaction } = require('../config/db');
const constants = require('../config/constants');
const { AppError } = require('../utils/asyncHandler');
const { toNumber } = require('../utils/geo');
const { badgeForTrust } = require('../utils/helpers');
const userModel = require('../models/user.model');
const volunteerModel = require('../models/volunteerProfile.model');
const seniorModel = require('../models/seniorProfile.model');
const requestModel = require('../models/serviceRequest.model');
const { writeAudit } = require('./audit.service');
const volunteerService = require('./volunteer.service');

async function createRequest(actor, body, req) {
  const { category, description, senior_id, latitude, longitude, idempotency_key, is_sos } = body || {};
  if (!category) throw new AppError(400, 'VALIDATION_ERROR', 'category is required');
  if (!description) throw new AppError(400, 'VALIDATION_ERROR', 'description is required');

  let seniorId = actor.id;
  if (actor.role === constants.ROLES.POLICE_ADMIN || actor.role === constants.ROLES.WARD_AGENT) {
    if (!senior_id) throw new AppError(400, 'VALIDATION_ERROR', 'senior_id is required when staff create a request');
    seniorId = senior_id;
  } else if (actor.role === constants.ROLES.SENIOR) {
    if (senior_id && senior_id !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Seniors can only create requests for themselves');
    }
  } else {
    throw new AppError(403, 'FORBIDDEN', 'Only SENIOR, POLICE_ADMIN or WARD_AGENT can create service requests');
  }

  if (idempotency_key) {
    const existing = await requestModel.findByIdempotency(idempotency_key);
    if (existing) return requestModel.publicRequest(existing);
  }

  const seniorUser = await userModel.findById(seniorId);
  if (!seniorUser || seniorUser.role !== constants.ROLES.SENIOR) {
    throw new AppError(400, 'VALIDATION_ERROR', 'senior_id must belong to a SENIOR user');
  }

  const profile = await seniorModel.findByUserId(seniorId);
  const lat = toNumber(latitude) ?? profile?.home_lat ?? 13.2435;
  const lng = toNumber(longitude) ?? profile?.home_lng ?? 74.8021;
  const cat = is_sos ? (String(category).startsWith('SOS') ? category : 'SOS_SAFETY') : category;

  return withTransaction(async (client) => {
    const created = await requestModel.create(
      {
        senior_id: seniorId,
        category: cat,
        description,
        location_lat: lat,
        location_lng: lng,
        idempotency_key: idempotency_key || null,
      },
      client
    );
    await writeAudit(client, {
      actorId: actor.id,
      action: is_sos ? 'SOS_REQUEST_CREATED' : 'SERVICE_REQUEST_CREATED',
      targetResource: 'service_requests',
      targetId: created.id,
      req,
      details: { senior_id: seniorId, category: cat, status: 'PENDING', version: 0 },
    });
    return requestModel.publicRequest(created);
  });
}

async function listRequests(actor, query) {
  if (actor.role === constants.ROLES.SENIOR) {
    const rows = await requestModel.list({ senior_id: actor.id, status: query.status });
    return rows.map(requestModel.publicRequest);
  }
  if (actor.role === constants.ROLES.VOLUNTEER) {
    if (query.mine === 'true') {
      const rows = await requestModel.list({ assigned_volunteer_id: actor.id, status: query.status });
      return rows.map(requestModel.publicRequest);
    }
    const rows = await requestModel.list({ status: query.status || constants.REQUEST_STATUSES.PENDING });
    return rows.map(requestModel.publicRequest);
  }
  const rows = await requestModel.list({ status: query.status, senior_id: query.senior_id });
  return rows.map(requestModel.publicRequest);
}

async function getRequest(id) {
  const row = await requestModel.findById(id);
  if (!row) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Service request not found');
  return requestModel.publicRequest(row);
}

async function acceptRequest(actor, id, version, req) {
  if (version === undefined || version === null || Number.isNaN(Number(version))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'version is required for optimistic locking (BR-02)');
  }

  return withTransaction(async (client) => {
    const profile = await volunteerModel.findByUserId(actor.id, client);
    volunteerService.assertCanAccept(profile);

    const existing = await requestModel.findById(id, client);
    if (!existing) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Service request not found');

    const accepted = await requestModel.acceptOptimistic(
      { id, volunteerId: actor.id, version: Number(version) },
      client
    );

    if (!accepted) {
      throw new AppError(409, 'CONFLICT', 'Request already assigned or version mismatch (BR-02)', {
        current_status: existing.status,
        current_version: existing.version,
      });
    }

    await writeAudit(client, {
      actorId: actor.id,
      action: 'SERVICE_REQUEST_ACCEPTED',
      targetResource: 'service_requests',
      targetId: id,
      req,
      details: {
        assigned_volunteer_id: actor.id,
        previous_version: Number(version),
        version: accepted.version,
        status: accepted.status,
      },
    });

    return {
      request_id: accepted.id,
      status: accepted.status,
      version: accepted.version,
      assigned_volunteer_id: accepted.assigned_volunteer_id,
      assigned_at: accepted.assigned_at,
    };
  });
}

async function progressRequest(actor, id, nextStatus, req) {
  const allowed = {
    IN_PROGRESS: constants.REQUEST_STATUSES.ASSIGNED,
    COMPLETED: constants.REQUEST_STATUSES.IN_PROGRESS,
    CANCELLED: [constants.REQUEST_STATUSES.PENDING, constants.REQUEST_STATUSES.ASSIGNED],
  };

  return withTransaction(async (client) => {
    const existing = await requestModel.findById(id, client);
    if (!existing) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Service request not found');

    if (nextStatus === 'IN_PROGRESS' || nextStatus === 'COMPLETED') {
      if (existing.assigned_volunteer_id !== actor.id && actor.role !== constants.ROLES.POLICE_ADMIN) {
        throw new AppError(403, 'FORBIDDEN', 'Only the assigned volunteer can update this request');
      }
    }
    if (nextStatus === 'CANCELLED') {
      const ok =
        actor.id === existing.senior_id ||
        actor.role === constants.ROLES.POLICE_ADMIN ||
        actor.id === existing.assigned_volunteer_id;
      if (!ok) throw new AppError(403, 'FORBIDDEN', 'Not allowed to cancel this request');
    }

    const expected = allowed[nextStatus];
    const expectedList = Array.isArray(expected) ? expected : [expected];
    if (!expectedList.includes(existing.status)) {
      throw new AppError(409, 'CONFLICT', `Cannot move from ${existing.status} to ${nextStatus}`);
    }

    const completed_at = nextStatus === 'COMPLETED' ? new Date() : null;
    const updated = await requestModel.updateStatus(id, { status: nextStatus, completed_at }, client);

    if (nextStatus === 'COMPLETED' && existing.assigned_volunteer_id) {
      const profile = await volunteerModel.findByUserId(existing.assigned_volunteer_id, client);
      if (profile) {
        const next = (profile.trust_score || 0) + 1;
        await volunteerModel.adjustTrust(existing.assigned_volunteer_id, 1, badgeForTrust(next), client);
        await volunteerModel.addNssPoints(existing.assigned_volunteer_id, 2, client);
      }
    }

    await writeAudit(client, {
      actorId: actor.id,
      action: `SERVICE_REQUEST_${nextStatus}`,
      targetResource: 'service_requests',
      targetId: id,
      req,
      details: { previous: existing.status, status: nextStatus },
    });

    return requestModel.publicRequest(updated);
  });
}

module.exports = {
  createRequest,
  listRequests,
  getRequest,
  acceptRequest,
  progressRequest,
};
