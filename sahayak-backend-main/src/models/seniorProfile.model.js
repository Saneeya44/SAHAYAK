const { query } = require('../config/db');
const env = require('../config/env');
const { pointWkt } = require('../utils/geo');

function publicSenior(row, { includeMedical = false } = {}) {
  if (!row) return null;
  const data = {
    id: row.id,
    user_id: row.user_id,
    full_name: row.full_name,
    phone_number: row.phone_number,
    ward_number: row.ward_number,
    address: row.address,
    primary_language: row.primary_language,
    emergency_contact_name: row.emergency_contact_name,
    emergency_contact_phone: row.emergency_contact_phone,
    mobility_restricted: row.mobility_restricted,
    home_location:
      row.home_lat != null
        ? { latitude: Number(row.home_lat), longitude: Number(row.home_lng) }
        : null,
    consent_given_at: row.consent_given_at,
    data_retention_expires_at: row.data_retention_expires_at,
    lives_alone: true,
  };
  if (includeMedical) {
    data.medical_conditions = row.medical_conditions || null;
  }
  return data;
}

async function create(data, executor = { query }) {
  const ex = executor || { query };
  const wkt = pointWkt(data.home_lat, data.home_lng);
  try {
    const result = await ex.query(
      `INSERT INTO senior_profiles (
          user_id, primary_language, emergency_contact_name, emergency_contact_phone,
          medical_conditions_encrypted, mobility_restricted, home_lat, home_lng,
          home_location, data_retention_expires_at
       ) VALUES (
          $1, $2, $3, $4,
          CASE WHEN $5::text IS NULL THEN NULL ELSE pgp_sym_encrypt($5, $6) END,
          $7, $8, $9, ST_GeogFromText($10), $11
       )
       RETURNING *`,
      [
        data.user_id,
        data.primary_language || 'kannada',
        data.emergency_contact_name,
        data.emergency_contact_phone,
        data.medical_conditions || null,
        env.medicalEncryptionKey,
        data.mobility_restricted === true,
        data.home_lat,
        data.home_lng,
        wkt,
        data.data_retention_expires_at || null,
      ]
    );
    return result.rows[0];
  } catch (_err) {
    const result = await ex.query(
      `INSERT INTO senior_profiles (
          user_id, primary_language, emergency_contact_name, emergency_contact_phone,
          medical_conditions_encrypted, mobility_restricted, home_lat, home_lng,
          data_retention_expires_at
       ) VALUES (
          $1, $2, $3, $4,
          CASE WHEN $5::text IS NULL THEN NULL ELSE pgp_sym_encrypt($5, $6) END,
          $7, $8, $9, $10
       )
       RETURNING *`,
      [
        data.user_id,
        data.primary_language || 'kannada',
        data.emergency_contact_name,
        data.emergency_contact_phone,
        data.medical_conditions || null,
        env.medicalEncryptionKey,
        data.mobility_restricted === true,
        data.home_lat,
        data.home_lng,
        data.data_retention_expires_at || null,
      ]
    );
    return result.rows[0];
  }
}

const SELECT_WITH_USER = `
  SELECT sp.*,
         u.full_name, u.phone_number, u.ward_number, u.address,
         CASE
           WHEN sp.medical_conditions_encrypted IS NULL THEN NULL
           ELSE pgp_sym_decrypt(sp.medical_conditions_encrypted, $2)::text
         END AS medical_conditions
  FROM senior_profiles sp
  JOIN users u ON u.id = sp.user_id
`;

async function findByUserId(userId, executor = { query }) {
  const result = await executor.query(`${SELECT_WITH_USER} WHERE sp.user_id = $1`, [
    userId,
    env.medicalEncryptionKey,
  ]);
  return result.rows[0] || null;
}

async function findByIdOrUserId(id, executor = { query }) {
  const result = await executor.query(`${SELECT_WITH_USER} WHERE sp.id = $1 OR sp.user_id = $1`, [
    id,
    env.medicalEncryptionKey,
  ]);
  return result.rows[0] || null;
}

async function listByWard(wardNumber, executor = { query }) {
  const params = [env.medicalEncryptionKey];
  let where = '';
  if (wardNumber !== undefined && wardNumber !== null && wardNumber !== '') {
    params.push(Number(wardNumber));
    where = `WHERE u.ward_number = $2`;
  }
  const result = await executor.query(
    `${SELECT_WITH_USER.replace('$2', '$1')} ${where} ORDER BY u.full_name ASC`,
    params
  );
  return result.rows;
}

async function updateByUserId(userId, fields, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `UPDATE senior_profiles SET
        primary_language = COALESCE($2, primary_language),
        emergency_contact_name = COALESCE($3, emergency_contact_name),
        emergency_contact_phone = COALESCE($4, emergency_contact_phone),
        medical_conditions_encrypted = CASE
          WHEN $5::text IS NULL THEN medical_conditions_encrypted
          ELSE pgp_sym_encrypt($5, $6)
        END,
        mobility_restricted = COALESCE($7, mobility_restricted),
        home_lat = COALESCE($8, home_lat),
        home_lng = COALESCE($9, home_lng)
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      fields.primary_language || null,
      fields.emergency_contact_name || null,
      fields.emergency_contact_phone || null,
      fields.medical_conditions === undefined ? null : fields.medical_conditions,
      env.medicalEncryptionKey,
      fields.mobility_restricted === undefined ? null : fields.mobility_restricted,
      fields.home_lat || null,
      fields.home_lng || null,
    ]
  );
  return result.rows[0] || null;
}

module.exports = {
  publicSenior,
  create,
  findByUserId,
  findByIdOrUserId,
  listByWard,
  updateByUserId,
};
