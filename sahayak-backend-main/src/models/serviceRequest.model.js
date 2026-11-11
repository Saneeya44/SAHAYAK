const { query } = require('../config/db');
const { pointWkt } = require('../utils/geo');

function publicRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    request_id: row.id,
    senior_id: row.senior_id,
    assigned_volunteer_id: row.assigned_volunteer_id,
    category: row.category,
    description: row.description,
    status: row.status,
    location:
      row.location_lat != null
        ? { latitude: Number(row.location_lat), longitude: Number(row.location_lng) }
        : null,
    idempotency_key: row.idempotency_key,
    version: row.version,
    assigned_at: row.assigned_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    senior_name: row.senior_name,
    volunteer_name: row.volunteer_name,
  };
}

const SELECT_JOIN = `
  SELECT sr.*,
         su.full_name AS senior_name,
         vu.full_name AS volunteer_name
  FROM service_requests sr
  JOIN users su ON su.id = sr.senior_id
  LEFT JOIN users vu ON vu.id = sr.assigned_volunteer_id
`;

async function create(data, executor = { query }) {
  const ex = executor || { query };
  const wkt = pointWkt(data.location_lat, data.location_lng);
  const params = [
    data.senior_id,
    data.category,
    data.description,
    data.location_lat,
    data.location_lng,
    data.idempotency_key || null,
    wkt,
  ];
  try {
    const result = await ex.query(
      `INSERT INTO service_requests (
          senior_id, category, description, status, location_lat, location_lng,
          location, idempotency_key, version
       ) VALUES ($1, $2, $3, 'PENDING', $4, $5, ST_GeogFromText($7), $6, 0)
       RETURNING *`,
      params
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') throw err;
    const result = await ex.query(
      `INSERT INTO service_requests (
          senior_id, category, description, status, location_lat, location_lng,
          idempotency_key, version
       ) VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, 0)
       RETURNING *`,
      params.slice(0, 6)
    );
    return result.rows[0];
  }
}

async function findById(id, executor = { query }) {
  const result = await executor.query(`${SELECT_JOIN} WHERE sr.id = $1`, [id]);
  return result.rows[0] || null;
}

async function findByIdempotency(key, executor = { query }) {
  if (!key) return null;
  const result = await executor.query(`${SELECT_JOIN} WHERE sr.idempotency_key = $1`, [key]);
  return result.rows[0] || null;
}

async function list(filters = {}, executor = { query }) {
  const clauses = [];
  const params = [];
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`sr.status = $${params.length}`);
  }
  if (filters.senior_id) {
    params.push(filters.senior_id);
    clauses.push(`sr.senior_id = $${params.length}`);
  }
  if (filters.assigned_volunteer_id) {
    params.push(filters.assigned_volunteer_id);
    clauses.push(`sr.assigned_volunteer_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await executor.query(
    `${SELECT_JOIN} ${where} ORDER BY sr.created_at DESC LIMIT 200`,
    params
  );
  return result.rows;
}

async function acceptOptimistic({ id, volunteerId, version }, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE service_requests
     SET status = 'ASSIGNED',
         assigned_volunteer_id = $1,
         assigned_at = CURRENT_TIMESTAMP,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND version = $3 AND status = 'PENDING'
     RETURNING *`,
    [volunteerId, id, version]
  );
  return result.rows[0] || null;
}

async function updateStatus(id, fields, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE service_requests
     SET status = COALESCE($2, status),
         completed_at = COALESCE($3, completed_at),
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id, fields.status || null, fields.completed_at || null]
  );
  return result.rows[0] || null;
}

async function revertStaleAssignments(minutes, executor = { query }) {
  const stale = await executor.query(
    `SELECT * FROM service_requests
     WHERE status = 'ASSIGNED'
       AND assigned_at IS NOT NULL
       AND assigned_at < (CURRENT_TIMESTAMP - ($1 || ' minutes')::interval)
     FOR UPDATE`,
    [String(minutes)]
  );
  if (stale.rowCount === 0) return [];

  const reverted = [];
  for (const row of stale.rows) {
    const updated = await executor.query(
      `UPDATE service_requests
       SET status = 'PENDING',
           assigned_volunteer_id = NULL,
           assigned_at = NULL,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [row.id]
    );
    reverted.push({ ...updated.rows[0], previous_volunteer_id: row.assigned_volunteer_id });
  }
  return reverted;
}

async function touchUpdatedAt(id, executor = { query }) {
  await executor.query(
    `UPDATE service_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('ASSIGNED', 'IN_PROGRESS')`,
    [id]
  );
}

module.exports = {
  publicRequest,
  create,
  findById,
  findByIdempotency,
  list,
  acceptOptimistic,
  updateStatus,
  revertStaleAssignments,
  touchUpdatedAt,
};
