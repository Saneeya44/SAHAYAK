const { query } = require('../config/db');

const PUBLIC_USER_COLUMNS = `
  id, full_name, phone_number, role, ward_number, address, is_active, created_at, updated_at
`;

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    phone_number: row.phone_number,
    role: row.role,
    ward_number: row.ward_number,
    address: row.address,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function findByPhone(phone, executor = { query }) {
  const result = await executor.query(
    `SELECT id, full_name, phone_number, password_hash, role, ward_number, address, is_active, created_at, updated_at
     FROM users WHERE phone_number = $1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function findById(id, executor = { query }) {
  const result = await executor.query(
    `SELECT ${PUBLIC_USER_COLUMNS}, password_hash FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function create(data, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `INSERT INTO users (full_name, phone_number, password_hash, role, ward_number, address, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [data.full_name, data.phone_number, data.password_hash, data.role, data.ward_number, data.address]
  );
  return result.rows[0];
}

async function setActive(id, isActive, executor = { query }) {
  const result = await executor.query(
    `UPDATE users SET is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [id, isActive]
  );
  return result.rows[0] || null;
}

module.exports = {
  PUBLIC_USER_COLUMNS,
  publicUser,
  findByPhone,
  findById,
  create,
  setActive,
};
