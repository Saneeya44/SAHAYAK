const { AppError } = require('../utils/asyncHandler');
const constants = require('../config/constants');
const userModel = require('../models/user.model');
const seniorModel = require('../models/seniorProfile.model');
const volunteerModel = require('../models/volunteerProfile.model');
const requestModel = require('../models/serviceRequest.model');
const { withTransaction } = require('../config/db');
const { writeAudit } = require('./audit.service');

function canViewSenior(actor, seniorUserId, assignedRequest) {
  if (!actor) return false;
  if (actor.role === constants.ROLES.POLICE_ADMIN) return true;
  if (actor.role === constants.ROLES.WARD_AGENT) return true;
  if (actor.role === constants.ROLES.SENIOR && actor.id === seniorUserId) return true;
  if (actor.role === constants.ROLES.VOLUNTEER && assignedRequest) return true;
  return false;
}

async function getSenior(id, actor) {
  const senior = await seniorModel.findByIdOrUserId(id);
  if (!senior) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Senior profile not found');

  let assigned = null;
  if (actor.role === constants.ROLES.VOLUNTEER) {
    const profile = await volunteerModel.findByUserId(actor.id);
    if (
      !profile ||
      ![constants.VERIFICATION_STATES.VERIFIED, constants.VERIFICATION_STATES.ACTIVE].includes(
        profile.verification_status
      )
    ) {
      throw new AppError(403, 'FORBIDDEN', 'Verified assignment only (BR-01)');
    }
    const assignedRows = await requestModel.list({
      senior_id: senior.user_id,
      assigned_volunteer_id: actor.id,
    });
    assigned = assignedRows.find((r) => ['ASSIGNED', 'IN_PROGRESS'].includes(r.status));
  }

  if (!canViewSenior(actor, senior.user_id, assigned)) {
    throw new AppError(403, 'FORBIDDEN', 'Not authorised to view this senior profile');
  }

  const includeMedical =
    actor.role === constants.ROLES.POLICE_ADMIN ||
    actor.id === senior.user_id ||
    Boolean(assigned);

  return seniorModel.publicSenior(senior, { includeMedical });
}

async function listSeniors(actor, wardNumber) {
  if (![constants.ROLES.POLICE_ADMIN, constants.ROLES.WARD_AGENT].includes(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Police Admin or Ward Agent required');
  }
  const full = await userModel.findById(actor.id);
  const ward = actor.role === constants.ROLES.WARD_AGENT ? full?.ward_number ?? wardNumber : wardNumber;
  const rows = await seniorModel.listByWard(ward);
  return rows.map((row) =>
    seniorModel.publicSenior(row, { includeMedical: actor.role === constants.ROLES.POLICE_ADMIN })
  );
}

async function updateMyProfile(userId, body, req) {
  return withTransaction(async (client) => {
    const existing = await seniorModel.findByUserId(userId, client);
    if (!existing) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Senior profile not found');
    await seniorModel.updateByUserId(userId, body, client);
    await writeAudit(client, {
      actorId: userId,
      action: 'SENIOR_PROFILE_UPDATED',
      targetResource: 'senior_profiles',
      targetId: existing.id,
      req,
      details: { fields: Object.keys(body || {}) },
    });
    const updated = await seniorModel.findByUserId(userId, client);
    return seniorModel.publicSenior(updated, { includeMedical: true });
  });
}

module.exports = { getSenior, listSeniors, updateMyProfile };
