const { query } = require('../config/db');

function publicPatrol(row) {
  if (!row) return null;
  return {
    id: row.id,
    senior_id: row.senior_id,
    senior_name: row.senior_name,
    officer_id: row.officer_id,
    officer_name: row.officer_name,
    ward_number: row.ward_number,
    condition_ok: row.condition_ok,
    notes: row.notes,
    checkin_location:
      row.checkin_lat != null
        ? { latitude: Number(row.checkin_lat), longitude: Number(row.checkin_lng) }
        : null,
    created_at: row.created_at,
  };
}

async function create(data, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `INSERT INTO beat_patrol_logs (
        senior_id, officer_id, ward_number, condition_ok, notes, checkin_lat, checkin_lng
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      data.senior_id,
      data.officer_id,
      data.ward_number ?? null,
      data.condition_ok !== false,
      data.notes || null,
      data.checkin_lat || null,
      data.checkin_lng || null,
    ]
  );
  return result.rows[0];
}

async function list(filters = {}, executor = { query }) {
  const clauses = [];
  const params = [];
  if (filters.senior_id) {
    params.push(filters.senior_id);
    clauses.push(`b.senior_id = $${params.length}`);
  }
  if (filters.today) {
    clauses.push(`b.created_at::date = CURRENT_DATE`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await executor.query(
    `SELECT b.*, s.full_name AS senior_name, o.full_name AS officer_name
     FROM beat_patrol_logs b
     JOIN users s ON s.id = b.senior_id
     JOIN users o ON o.id = b.officer_id
     ${where}
     ORDER BY b.created_at DESC
     LIMIT 200`,
    params
  );
  return result.rows;
}

module.exports = { publicPatrol, create, list };
