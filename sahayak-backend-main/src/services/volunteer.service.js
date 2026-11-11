const { withTransaction } = require('../config/db');
const constants = require('../config/constants');
const { AppError } = require('../utils/asyncHandler');
const { badgeForTrust } = require('../utils/helpers');
const volunteerModel = require('../models/volunteerProfile.model');
const { writeAudit } = require('./audit.service');

const FORWARD = {
  REGISTERED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['ACTIVE', 'SUSPENDED', 'REJECTED'],
  ACTIVE: ['SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'REJECTED'],
  REJECTED: [],
};

function listVolunteers(query) {
  return volunteerModel.list({ status: query.status, ward_number: query.ward_number });
}

async function verifyVolunteer({ id, nextStatus, policeId, req }) {
  const allowed = ['UNDER_REVIEW', 'VERIFIED', 'ACTIVE', 'REJECTED', 'SUSPENDED'];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(400, 'VALIDATION_ERROR', `verification_status must be one of: ${allowed.join(', ')}`);
  }

  return withTransaction(async (client) => {
    const found = await volunteerModel.findByIdOrUserId(id, client);
    if (!found) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Volunteer profile not found');
    }

    const current = found.verification_status;
    const allowedNext = FORWARD[current] || [];
    if (!allowedNext.includes(nextStatus)) {
      throw new AppError(
        409,
        'CONFLICT',
        `Invalid verification transition ${current} → ${nextStatus}`,
        { current, allowed: allowedNext }
      );
    }

    const updated = await volunteerModel.updateVerification(
      found.id,
      { verification_status: nextStatus, verified_by_police_id: policeId },
      client
    );

    await writeAudit(client, {
      actorId: policeId,
      action: `VOLUNTEER_${nextStatus}`,
      targetResource: 'volunteer_profiles',
      targetId: found.id,
      req,
      details: { previous_status: current, verification_status: nextStatus, volunteer_user_id: found.user_id },
    });

    return volunteerModel.publicVolunteer({ ...found, ...updated });
  });
}

async function updateMyLocation(userId, lat, lng) {
  if (lat === undefined || lng === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'latitude and longitude are required');
  }
  const updated = await volunteerModel.updateLocation(userId, Number(lat), Number(lng));
  if (!updated) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Volunteer profile not found');
  return volunteerModel.publicVolunteer(updated);
}

function assertCanAccept(profile) {
  if (!profile) {
    throw new AppError(403, 'FORBIDDEN', 'Volunteer profile not found');
  }
  if (![constants.VERIFICATION_STATES.VERIFIED, constants.VERIFICATION_STATES.ACTIVE].includes(profile.verification_status)) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only VERIFIED or ACTIVE volunteers can accept tasks or view senior details (BR-01)'
    );
  }
}

async function applyTrustPenalty(userId, executor) {
  const profile = await volunteerModel.findByUserId(userId, executor);
  if (!profile) return null;
  const nextScore = Math.max((profile.trust_score || 0) - constants.TRUST_PENALTY, 0);
  const badge = badgeForTrust(nextScore);
  const updated = await volunteerModel.adjustTrust(userId, -constants.TRUST_PENALTY, badge, executor);
  if (nextScore < constants.TRUST_SUSPEND_THRESHOLD) {
    await volunteerModel.updateVerification(
      profile.id,
      { verification_status: constants.VERIFICATION_STATES.SUSPENDED },
      executor
    );
  }
  return updated;
}

module.exports = {
  listVolunteers,
  verifyVolunteer,
  updateMyLocation,
  assertCanAccept,
  applyTrustPenalty,
};
