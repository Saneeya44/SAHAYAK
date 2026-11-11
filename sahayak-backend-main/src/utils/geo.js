function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointWkt(lat, lng) {
  if (lat === null || lng === null || lat === undefined || lng === undefined) return null;
  return `SRID=4326;POINT(${Number(lng)} ${Number(lat)})`;
}

function publicPoint(lat, lng) {
  if (lat === null || lng === null || lat === undefined || lng === undefined) return null;
  return {
    latitude: Number(lat),
    longitude: Number(lng),
    elevation_m: 0,
    srid: 4326,
  };
}

module.exports = { toNumber, haversineMeters, pointWkt, publicPoint };
