const { query } = require('../config/db');

function publicIncident(row) {
  if (!row) return null;
  return {
    id: row.id,
    tracking_id: row.tracking_id,
    reporter_id: row.reporter_id,
    reporter_name: row.reporter_name,
    category: row.category,
    description: row.description,
    status: row.status,
    ward_number: row.ward_number,
    location: { latitude: Number(row.location_lat), longitude: Number(row.location_lng) },
    assigned_officer_id: row.assigned_officer_id,
    resolution_notes: row.resolution_notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function create(data, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `INSERT INTO citizen_incidents (
        tracking_id, reporter_id, category, description, ward_number, location_lat, location_lng
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      data.tracking_id,
      data.reporter_id,
      data.category,
      data.description,
      data.ward_number ?? null,
      data.location_lat,
      data.location_lng,
    ]
  );
  return result.rows[0];
}

async function findByTrackingId(trackingId, executor = { query }) {
  const result = await executor.query(
    `SELECT ci.*, u.full_name AS reporter_name
     FROM citizen_incidents ci
     JOIN users u ON u.id = ci.reporter_id
     WHERE ci.tracking_id = $1 OR ci.id::text = $1`,
    [trackingId]
  );
  return result.rows[0] || null;
}

async function list(filters = {}, executor = { query }) {
  const clauses = [];
  const params = [];
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`ci.status = $${params.length}`);
  }
  if (filters.reporter_id) {
    params.push(filters.reporter_id);
    clauses.push(`ci.reporter_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await executor.query(
    `SELECT ci.*, u.full_name AS reporter_name
     FROM citizen_incidents ci
     JOIN users u ON u.id = ci.reporter_id
     ${where}
     ORDER BY ci.created_at DESC
     LIMIT 200`,
    params
  );
  return result.rows;
}

async function updateStatus(id, fields, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE citizen_incidents
     SET status = COALESCE($2, status),
         assigned_officer_id = COALESCE($3, assigned_officer_id),
         resolution_notes = COALESCE($4, resolution_notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id, fields.status || null, fields.assigned_officer_id || null, fields.resolution_notes || null]
  );
  return result.rows[0] || null;
}

module.exports = { publicIncident, create, findByTrackingId, list, updateStatus };
