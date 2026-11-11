require('dotenv').config();

function requireEnv(name, fallback) {
  if (process.env[name] !== undefined && process.env[name] !== '') {
    return process.env[name];
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is not set`);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: requireEnv('DATABASE_URL'),
  databaseSsl: process.env.DATABASE_SSL === 'true' || String(process.env.DATABASE_URL || '').includes('supabase'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  medicalEncryptionKey: process.env.MEDICAL_ENCRYPTION_KEY || process.env.JWT_SECRET,
  webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET || process.env.JWT_SECRET,
  policeAdminInviteCode: process.env.POLICE_ADMIN_INVITE_CODE || 'SHIRVA-PS-03',
  redisUrl: process.env.REDIS_URL || '',
  erss112Url:
    process.env.ERSS_112_URL ||
    'https://erss112.karnataka.gov.in/api/v1/dispatch/emergency-ingest',
  policeDeptApiKey: process.env.POLICE_DEPT_API_KEY || '',
  stationCode: process.env.STATION_CODE || 'PS-03-SHIRVA',
  stationDistrict: process.env.STATION_DISTRICT || 'Udupi',
  cctvSigningSecret: process.env.CCTV_SIGNING_SECRET || process.env.JWT_SECRET,
  cctvBaseUrl: process.env.CCTV_BASE_URL || 'https://cctv.shirva-ps03.karnataka.gov.in',
};

module.exports = env;
