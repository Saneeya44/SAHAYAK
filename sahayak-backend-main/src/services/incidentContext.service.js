const constants = require('../config/constants');
const { AppError } = require('../utils/asyncHandler');
const { haversineMeters } = require('../utils/geo');
const { signedCctvUrl } = require('./erss112.service');
const requestModel = require('../models/serviceRequest.model');
const volunteerModel = require('../models/volunteerProfile.model');
const seniorModel = require('../models/seniorProfile.model');
const emergencyModel = require('../models/emergency112.model');
const incidentModel = require('../models/citizenIncident.model');

async function incidentContext(id) {
  let request = await requestModel.findById(id);
  let incident = null;
  if (!request) {
    incident = await incidentModel.findByTrackingId(id);
  }
  if (!request && !incident) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Incident context does not exist');
  }

  const lat = request ? Number(request.location_lat) : Number(incident.location_lat);
  const lng = request ? Number(request.location_lng) : Number(incident.location_lng);

  const nearbyRows = await volunteerModel.nearby(lat, lng, constants.NEARBY_VOLUNTEER_RADIUS_METERS);
  const radar = nearbyRows
    .map((row) => {
      const distance_m =
        row.distance_m != null
          ? Number(row.distance_m)
          : haversineMeters(lat, lng, row.last_known_lat, row.last_known_lng);
      return {
        volunteer_user_id: row.user_id,
        full_name: row.full_name,
        verification_status: row.verification_status,
        trust_score: row.trust_score,
        badge_title: row.badge_title,
        location: { latitude: Number(row.last_known_lat), longitude: Number(row.last_known_lng) },
        distance_m: Math.round(distance_m),
      };
    })
    .filter((v) => Number.isFinite(v.distance_m))
    .sort((a, b) => a.distance_m - b.distance_m);

  const senior = request ? await seniorModel.findByUserId(request.senior_id) : null;
  const emergencies = request
    ? (await emergencyModel.listAll(50)).filter((e) => e.request_id === request.id)
    : [];

  return {
    incident_id: request ? request.id : incident.id,
    kind: request ? 'SERVICE_REQUEST' : 'CITIZEN_INCIDENT',
    status: request ? request.status : incident.status,
    origin: { latitude: lat, longitude: lng, elevation_m: 12.4, srid: 4326 },
    viewport_3d: {
      enabled_on_demand: true,
      engine: 'CesiumJS',
      default_2d_engine: 'Leaflet/MapLibre',
      look_at: { longitude: lng, latitude: lat, height: 220 },
    },
    volunteer_radar: radar,
    signed_cctv: signedCctvUrl(request ? request.id : incident.id),
    senior: senior
      ? {
          user_id: senior.user_id,
          full_name: senior.full_name,
          phone_number: senior.phone_number,
          mobility_restricted: senior.mobility_restricted,
          emergency_contact_name: senior.emergency_contact_name,
          emergency_contact_phone: senior.emergency_contact_phone,
          medical_conditions: senior.medical_conditions || null,
        }
      : null,
    emergency_112_logs: emergencies.map(emergencyModel.publicEmergency),
    citizen_incident: incident ? incidentModel.publicIncident(incident) : null,
    request: request ? requestModel.publicRequest(request) : null,
  };
}

module.exports = { incidentContext };
