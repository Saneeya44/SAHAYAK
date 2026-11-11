const { query } = require('../config/db');

async function insert(data, executor = { query }) {
  const result = await executor.query(
    `INSERT INTO audit_logs (actor_id, action, target_resource, target_id, ip_address, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, actor_id, action, target_resource, target_id, ip_address, details, created_at`,
    [
      data.actor_id,
      data.action,
      data.target_resource,
      data.target_id || null,
      data.ip_address || '0.0.0.0',
      JSON.stringify(data.details || {}),
    ]
  );
  return result.rows[0];
}

async function list({ limit = 100 } = {}, executor = { query }) {
  const result = await executor.query(
    `SELECT a.*, u.full_name AS actor_name, u.role AS actor_role
     FROM audit_logs a
     JOIN users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = { insert, list };
