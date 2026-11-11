const crypto = require('crypto');
const env = require('../config/env');
const constants = require('../config/constants');
const { hmacSha256 } = require('../utils/jwt');

function signedCctvUrl(incidentId) {
  const exp = Math.floor(Date.now() / 1000) + constants.CCTV_URL_TTL_SECONDS;
  const sig = hmacSha256(env.cctvSigningSecret, `${incidentId}:${exp}`);
  return {
    url: `${env.cctvBaseUrl}/stream/${incidentId}?exp=${exp}&sig=${sig}`,
    expires_in_seconds: constants.CCTV_URL_TTL_SECONDS,
  };
}

async function dispatchTo112(payload) {
  const body = JSON.stringify(payload);
  if (!env.policeDeptApiKey) {
    return {
      ok: false,
      status: 0,
      reference: `LOCAL-${crypto.randomUUID()}`,
      note: 'POLICE_DEPT_API_KEY not set; dispatch recorded locally for sandbox/demo.',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(env.erss112Url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.policeDeptApiKey}`,
        'X-Station-Code': env.stationCode,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    let parsed = null;
    try {
      parsed = await response.json();
    } catch (_err) {
      parsed = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      reference: (parsed && (parsed.reference_id || parsed.id)) || `ERSS-${Date.now()}`,
      body: parsed,
    };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      reference: `UNAVAILABLE-${crypto.randomUUID()}`,
      note: `ERSS 112 unavailable: ${err.message}. Emergency log retained (ERR-02).`,
    };
  }
}

function buildDispatchPayload({ location, seniorContact, incidentType, threatLevel, rawAudioUrl, transcription }) {
  return {
    station_id: env.stationCode,
    district: env.stationDistrict,
    incident_type: incidentType || 'SENIOR_MEDICAL_EMERGENCY',
    threat_level: threatLevel || 'HIGH_CRITICAL_RED',
    location: {
      latitude: location?.latitude ?? 13.2435,
      longitude: location?.longitude ?? 74.8021,
    },
    senior_contact: seniorContact || '',
    raw_audio_url: rawAudioUrl || null,
    transcription: transcription || null,
  };
}

module.exports = { signedCctvUrl, dispatchTo112, buildDispatchPayload };
