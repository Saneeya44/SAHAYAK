function badgeForTrust(score) {
  const n = Number(score) || 0;
  if (n >= 25) return 'Shirva Sentinel';
  if (n >= 15) return 'Community Guardian';
  return 'Novice Guardian';
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function generateTrackingId() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SHV-${y}${m}${d}-${rand}`;
}

module.exports = { badgeForTrust, addDays, clientIp, isUuid, generateTrackingId };
