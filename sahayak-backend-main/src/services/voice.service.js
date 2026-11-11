const { query } = require('../config/db');
const { AppError } = require('../utils/asyncHandler');
const userModel = require('../models/user.model');
const requestModel = require('../models/serviceRequest.model');
const { escalate } = require('./emergency.service');

async function handleInbound(body, req) {
  const {
    phone_number,
    request_id,
    transcription_text,
    transcription_confidence,
    dialect_detected,
    raw_audio_url,
    idempotency_key,
    source,
  } = body || {};

  if (!transcription_text && !raw_audio_url) {
    throw new AppError(400, 'VALIDATION_ERROR', 'transcription_text or raw_audio_url is required');
  }

  let user = null;
  if (phone_number) user = await userModel.findByPhone(phone_number);

  let request = null;
  if (request_id) request = await requestModel.findById(request_id);

  if (!request && user) {
    request = await requestModel.create(
      {
        senior_id: user.id,
        category: 'SOS_SAFETY',
        description: transcription_text || 'Voice SOS',
        location_lat: 13.2435,
        location_lng: 74.8021,
        idempotency_key: idempotency_key ? `${idempotency_key}-req` : null,
      },
      { query }
    );
  }

  if (!request) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Unable to resolve a senior user or request for this voice event');
  }

  const triggerUser = user || (await userModel.findById(request.senior_id));

  return escalate({
    actor: triggerUser ? { id: triggerUser.id, role: triggerUser.role } : null,
    requestId: request.id,
    body: {
      reason: transcription_text || 'Voice/IVR emergency',
      escalation_source: source || 'VOICE',
      idempotency_key,
      raw_audio_url,
      transcription_text,
      transcription_confidence,
      dialect_detected,
      triggered_by_user_id: triggerUser?.id,
    },
    req,
    sourceOverride: source || 'VOICE',
  });
}

module.exports = { handleInbound };
