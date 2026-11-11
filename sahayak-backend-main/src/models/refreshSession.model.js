const { query } = require('../config/db');

async function create({ userId, tokenHash, expiresAt }, executor = { query }) {
  const ex = executor || { query };
  const result = await ex.query(
    `INSERT INTO refresh_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, tokenHash, expiresAt]
  );
  return result.rows[0];
}

async function findValid(tokenHash, executor = { query }) {
  const result = await executor.query(
    `SELECT * FROM refresh_sessions
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function revoke(tokenHash, executor = { query }) {
  await executor.query(
    `UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}

async function revokeAllForUser(userId, executor = { query }) {
  await executor.query(
    `UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

module.exports = { create, findValid, revoke, revokeAllForUser };
