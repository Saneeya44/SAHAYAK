const { query } = require('../config/db');

async function create(data, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `INSERT INTO police_alerts (alert_type, severity, title, message, related_request_id, related_user_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.alert_type,
      data.severity || 'HIGH',
      data.title,
      data.message,
      data.related_request_id || null,
      data.related_user_id || null,
    ]
  );
  return result.rows[0];
}

async function listUnacked(executor = { query }) {
  const result = await executor.query(
    `SELECT * FROM police_alerts WHERE is_acknowledged = FALSE ORDER BY created_at DESC`
  );
  return result.rows;
}

async function listAll(limit = 100, executor = { query }) {
  const result = await executor.query(
    `SELECT * FROM police_alerts ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function acknowledge(id, officerId, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE police_alerts
     SET is_acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id, officerId]
  );
  return result.rows[0] || null;
}

module.exports = { create, listUnacked, listAll, acknowledge };
