require('dotenv').config();
const { query, pool } = require('../config/db');

(async () => {
  const u = await query('SELECT id, role, phone_number FROM users WHERE phone_number LIKE $1', [
    '900000000%',
  ]);
  console.log('users', u.rows);
  const s = await query('SELECT user_id FROM senior_profiles');
  console.log('senior_profiles', s.rowCount);
  const v = await query('SELECT user_id, verification_status FROM volunteer_profiles');
  console.log('volunteers', v.rows);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
