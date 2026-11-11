const { withTransaction } = require('../config/db');
const constants = require('../config/constants');
const { AppError } = require('../utils/asyncHandler');
const userModel = require('../models/user.model');
const seniorModel = require('../models/seniorProfile.model');
const requestModel = require('../models/serviceRequest.model');
const emergencyModel = require('../models/emergency112.model');
const policeAlertModel = require('../models/policeAlert.model');
const { writeAudit } = require('./audit.service');
const { dispatchTo112, buildDispatchPayload } = require('./erss112.service');

async function escalate({ actor, requestId, body, req, sourceOverride }) {
  const {
    reason,
    escalation_reason,
    escalation_source,
    idempotency_key,
    raw_audio_url,
    transcription_text,
    transcription_confidence,
    dialect_detected,
    threat_flag,
    triggered_by_user_id,
  } = body || {};

  const why = reason || escalation_reason;
  if (!why) throw new AppError(400, 'VALIDATION_ERROR', 'reason is required');

  const source = sourceOverride || escalation_source || 'APP';
  if (!constants.ESCALATION_SOURCES.includes(source)) {
    throw new AppError(400, 'VALIDATION_ERROR', `escalation_source must be one of: ${constants.ESCALATION_SOURCES.join(', ')}`);
  }

  if (idempotency_key) {
    const dup = await emergencyModel.findByIdempotency(idempotency_key);
    if (dup) {
      return { emergency_log_id: dup.id, status: 'ESCALATED_112', duplicate: true, log: emergencyModel.publicEmergency(dup) };
    }
  }

  const confidence = transcription_confidence === undefined ? null : Number(transcription_confidence);
  const humanFallback =
    confidence !== null && !Number.isNaN(confidence) && confidence < constants.VOICE_CONFIDENCE_THRESHOLD;

  return withTransaction(async (client) => {
    const request = await requestModel.findById(requestId, client);
    if (!request) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Service request not found');

    const triggerUserId = actor?.id || triggered_by_user_id;
    if (!triggerUserId) throw new AppError(400, 'VALIDATION_ERROR', 'triggered_by_user_id is required for unauthenticated escalation');

    const senior = await seniorModel.findByUserId(request.senior_id, client);
    const seniorUser = await userModel.findById(request.senior_id, client);

    const payload = buildDispatchPayload({
      location: { latitude: request.location_lat, longitude: request.location_lng },
      seniorContact: seniorUser?.phone_number,
      incidentType: request.category?.startsWith('SOS') ? 'SENIOR_MEDICAL_EMERGENCY' : 'SENIOR_ASSISTANCE_ESCALATION',
      threatLevel: threat_flag || 'HIGH_CRITICAL_RED',
      rawAudioUrl: raw_audio_url,
      transcription: transcription_text || why,
    });

    const erss = await dispatchTo112(payload);

    const log = await emergencyModel.create(
      {
        request_id: request.id,
        triggered_by_user_id: triggerUserId,
        threat_flag: threat_flag || 'HIGH_CRITICAL_RED',
        escalation_reason: why,
        escalation_source: source,
        raw_audio_url,
        transcription_text,
        transcription_confidence: confidence,
        dialect_detected,
        human_fallback_triggered: humanFallback,
        idempotency_key: idempotency_key || null,
        dispatch_payload: payload,
        api_response_code: erss.status || 0,
        external_112_reference_id: erss.reference,
        dispatched_unit_id: erss.ok ? 'PS-03-SHIRVA-PATROL' : null,
      },
      client
    );

    await requestModel.updateStatus(
      request.id,
      { status: constants.REQUEST_STATUSES.ESCALATED_112 },
      client
    );

    await policeAlertModel.create(
      {
        alert_type: humanFallback ? 'VOICE_HUMAN_FALLBACK' : 'EMERGENCY_112',
        severity: 'HIGH_CRITICAL_RED',
        title: humanFallback ? 'Low-confidence voice SOS needs operator' : '112 escalation from Shirva PS-03',
        message: why,
        related_request_id: request.id,
        related_user_id: request.senior_id,
      },
      client
    );

    await writeAudit(client, {
      actorId: triggerUserId,
      action: 'EMERGENCY_112_ESCALATED',
      targetResource: 'emergency_112_logs',
      targetId: log.id,
      req,
      details: {
        request_id: request.id,
        source,
        human_fallback_triggered: humanFallback,
        erss_status: erss.status,
        medical_on_file: Boolean(senior?.medical_conditions),
      },
    });

    return {
      emergency_log_id: log.id,
      status: 'ESCALATED_112',
      human_fallback_triggered: humanFallback,
      external_112_reference_id: log.external_112_reference_id,
      log: emergencyModel.publicEmergency(log),
    };
  });
}

async function listEmergencies(query) {
  if (query.unacked === 'true') {
    return (await emergencyModel.listUnacked()).map(emergencyModel.publicEmergency);
  }
  return (await emergencyModel.listAll(Number(query.limit) || 100)).map(emergencyModel.publicEmergency);
}

async function acknowledgeEmergency(id, actor, req) {
  return withTransaction(async (client) => {
    const updated = await emergencyModel.acknowledge(id, client);
    if (!updated) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Emergency log not found');
    await requestModel.updateStatus(updated.request_id, { status: constants.REQUEST_STATUSES.POLICE_DISPATCHED }, client);
    await writeAudit(client, {
      actorId: actor.id,
      action: 'EMERGENCY_112_ACKNOWLEDGED',
      targetResource: 'emergency_112_logs',
      targetId: id,
      req,
      details: {},
    });
    return emergencyModel.publicEmergency(updated);
  });
}

module.exports = { escalate, listEmergencies, acknowledgeEmergency };
