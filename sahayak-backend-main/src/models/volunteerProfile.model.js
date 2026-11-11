const { query } = require('../config/db');
const { pointWkt } = require('../utils/geo');

function publicVolunteer(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    organisation_id: row.organisation_id,
    id_proof_type: row.id_proof_type,
    id_proof_number: row.id_proof_number,
    id_document_url: row.id_document_url,
    verification_status: row.verification_status,
    verified_by_police_id: row.verified_by_police_id,
    trust_score: row.trust_score,
    nss_ncc_points: row.nss_ncc_points,
    badge_title: row.badge_title,
    last_known_location:
      row.last_known_lat != null
        ? { latitude: Number(row.last_known_lat), longitude: Number(row.last_known_lng) }
        : null,
    created_at: row.created_at,
    full_name: row.full_name,
    phone_number: row.phone_number,
    ward_number: row.ward_number,
  };
}

async function create(data, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `INSERT INTO volunteer_profiles (
        user_id, organisation_id, id_proof_type, id_proof_number, id_document_url, verification_status
     ) VALUES ($1, $2, $3, $4, $5, 'REGISTERED')
     RETURNING *`,
    [
      data.user_id,
      data.organisation_id || null,
      data.id_proof_type,
      data.id_proof_number,
      data.id_document_url || '',
    ]
  );
  return result.rows[0];
}

async function findByUserId(userId, executor = { query }) {
  const result = await executor.query(
    `SELECT vp.*, u.full_name, u.phone_number, u.ward_number
     FROM volunteer_profiles vp
     JOIN users u ON u.id = vp.user_id
     WHERE vp.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function findByIdOrUserId(id, executor = { query }) {
  const result = await executor.query(
    `SELECT vp.*, u.full_name, u.phone_number, u.ward_number
     FROM volunteer_profiles vp
     JOIN users u ON u.id = vp.user_id
     WHERE vp.id = $1 OR vp.user_id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function list({ status, ward_number } = {}, executor = { query }) {
  const clauses = [];
  const params = [];
  if (status) {
    params.push(status);
    clauses.push(`vp.verification_status = $${params.length}`);
  }
  if (ward_number !== undefined && ward_number !== null && ward_number !== '') {
    params.push(Number(ward_number));
    clauses.push(`u.ward_number = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await executor.query(
    `SELECT vp.*, u.full_name, u.phone_number, u.ward_number
     FROM volunteer_profiles vp
     JOIN users u ON u.id = vp.user_id
     ${where}
     ORDER BY vp.created_at DESC`,
    params
  );
  return result.rows;
}

async function updateVerification(id, fields, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE volunteer_profiles
     SET verification_status = $2,
         verified_by_police_id = COALESCE($3, verified_by_police_id)
     WHERE id = $1
     RETURNING *`,
    [id, fields.verification_status, fields.verified_by_police_id || null]
  );
  return result.rows[0] || null;
}

async function adjustTrust(userId, delta, badgeTitle, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE volunteer_profiles
     SET trust_score = GREATEST(trust_score + $2, 0),
         badge_title = $3
     WHERE user_id = $1
     RETURNING *`,
    [userId, delta, badgeTitle]
  );
  return result.rows[0] || null;
}

async function addNssPoints(userId, points, executor = { query }) {
  const ex = executor || { query };
  await ex.query(
    `UPDATE volunteer_profiles SET nss_ncc_points = nss_ncc_points + $2 WHERE user_id = $1`,
    [userId, points]
  );
}

async function updateLocation(userId, lat, lng, executor = { query }) {
  const wkt = pointWkt(lat, lng);
  try {
    const result = await executor.query(
      `UPDATE volunteer_profiles
       SET last_known_lat = $2,
           last_known_lng = $3,
           last_known_location = ST_GeogFromText($4)
       WHERE user_id = $1
       RETURNING *`,
      [userId, lat, lng, wkt]
    );
    return result.rows[0] || null;
  } catch (_err) {
    const result = await executor.query(
      `UPDATE volunteer_profiles
       SET last_known_lat = $2, last_known_lng = $3
       WHERE user_id = $1
       RETURNING *`,
      [userId, lat, lng]
    );
    return result.rows[0] || null;
  }
}

async function nearby(lat, lng, radiusMeters, executor = { query }) {
  try {
    const result = await executor.query(
      `SELECT vp.*, u.full_name, u.phone_number, u.ward_number,
              ST_Distance(vp.last_known_location, ST_GeogFromText($3)) AS distance_m
       FROM volunteer_profiles vp
       JOIN users u ON u.id = vp.user_id
       WHERE vp.verification_status IN ('VERIFIED', 'ACTIVE')
         AND vp.last_known_location IS NOT NULL
         AND ST_DWithin(vp.last_known_location, ST_GeogFromText($3), $4)
       ORDER BY distance_m ASC
       LIMIT 25`,
      [lat, lng, pointWkt(lat, lng), radiusMeters]
    );
    return result.rows;
  } catch (_err) {
    const result = await executor.query(
      `SELECT vp.*, u.full_name, u.phone_number, u.ward_number
       FROM volunteer_profiles vp
       JOIN users u ON u.id = vp.user_id
       WHERE vp.verification_status IN ('VERIFIED', 'ACTIVE')
         AND vp.last_known_lat IS NOT NULL
         AND vp.last_known_lng IS NOT NULL`
    );
    return result.rows;
  }
}

module.exports = {
  publicVolunteer,
  create,
  findByUserId,
  findByIdOrUserId,
  list,
  updateVerification,
  adjustTrust,
  addNssPoints,
  updateLocation,
  nearby,
};
