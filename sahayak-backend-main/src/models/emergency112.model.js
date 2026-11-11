const { query } = require('../config/db');

function publicEmergency(row) {
  if (!row) return null;
  return {
    id: row.id,
    emergency_log_id: row.id,
    request_id: row.request_id,
    triggered_by_user_id: row.triggered_by_user_id,
    threat_flag: row.threat_flag,
    escalation_reason: row.escalation_reason,
    escalation_source: row.escalation_source,
    raw_audio_url: row.raw_audio_url,
    transcription_text: row.transcription_text,
    transcription_confidence: row.transcription_confidence
      ? Number(row.transcription_confidence)
      : null,
    dialect_detected: row.dialect_detected,
    human_fallback_triggered: row.human_fallback_triggered,
    idempotency_key: row.idempotency_key,
    external_112_reference_id: row.external_112_reference_id,
    dispatched_unit_id: row.dispatched_unit_id,
    police_response_time_seconds: row.police_response_time_seconds,
    closure_report: row.closure_report,
    dispatch_payload: row.dispatch_payload,
    api_response_code: row.api_response_code,
    acknowledged_by_police: row.acknowledged_by_police,
    created_at: row.created_at,
  };
}

async function create(data, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `INSERT INTO emergency_112_logs (
        request_id, triggered_by_user_id, threat_flag, escalation_reason, escalation_source,
        raw_audio_url, transcription_text, transcription_confidence, dialect_detected,
        human_fallback_triggered, idempotency_key, dispatch_payload, api_response_code,
        external_112_reference_id, dispatched_unit_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)
     RETURNING *`,
    [
      data.request_id || null,
      data.triggered_by_user_id,
      data.threat_flag || 'HIGH_CRITICAL_RED',
      data.escalation_reason,
      data.escalation_source || 'APP',
      data.raw_audio_url || null,
      data.transcription_text || null,
      data.transcription_confidence ?? null,
      data.dialect_detected || null,
      data.human_fallback_triggered === true,
      data.idempotency_key || null,
      JSON.stringify(data.dispatch_payload || {}),
      data.api_response_code ?? 0,
      data.external_112_reference_id || null,
      data.dispatched_unit_id || null,
    ]
  );
  return result.rows[0];
}

async function findByIdempotency(key, executor = { query }) {
  if (!key) return null;
  const result = await executor.query(`SELECT * FROM emergency_112_logs WHERE idempotency_key = $1`, [
    key,
  ]);
  return result.rows[0] || null;
}

async function findById(id, executor = { query }) {
  const result = await executor.query(`SELECT * FROM emergency_112_logs WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function listUnacked(executor = { query }) {
  const result = await executor.query(
    `SELECT * FROM emergency_112_logs WHERE acknowledged_by_police = FALSE ORDER BY created_at DESC`
  );
  return result.rows;
}

async function listAll(limit = 100, executor = { query }) {
  const result = await executor.query(
    `SELECT * FROM emergency_112_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function acknowledge(id, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE emergency_112_logs
     SET acknowledged_by_police = TRUE
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

async function close(id, fields, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE emergency_112_logs
     SET closure_report = $2,
         police_response_time_seconds = COALESCE($3, police_response_time_seconds),
         dispatched_unit_id = COALESCE($4, dispatched_unit_id)
     WHERE id = $1
     RETURNING *`,
    [id, fields.closure_report, fields.police_response_time_seconds || null, fields.dispatched_unit_id || null]
  );
  return result.rows[0] || null;
}

module.exports = {
  publicEmergency,
  create,
  findByIdempotency,
  findById,
  listUnacked,
  listAll,
  acknowledge,
  close,
};
