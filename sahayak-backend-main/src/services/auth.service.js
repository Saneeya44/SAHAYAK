const { withTransaction } = require('../config/db');
const env = require('../config/env');
const constants = require('../config/constants');
const { AppError } = require('../utils/asyncHandler');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyToken, hashToken, randomId } = require('../utils/jwt');
const { addDays } = require('../utils/helpers');
const userModel = require('../models/user.model');
const volunteerModel = require('../models/volunteerProfile.model');
const seniorModel = require('../models/seniorProfile.model');
const refreshModel = require('../models/refreshSession.model');
const { writeAudit } = require('./audit.service');

const ALLOWED_REGISTER_ROLES = Object.values(constants.ROLES);

function parseRefreshExpiryDate() {
  const spec = env.jwtRefreshExpiresIn;
  if (spec.endsWith('d')) return addDays(new Date(), Number(spec.replace('d', '')) || 7);
  if (spec.endsWith('h')) return new Date(Date.now() + Number(spec.replace('h', '')) * 3600 * 1000);
  return addDays(new Date(), 7);
}

function setRefreshCookie(res, token) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

async function register(body, req) {
  const {
    full_name,
    phone_number,
    password,
    role,
    ward_number,
    address,
    invite_code,
    id_proof_type,
    id_proof_number,
    id_document_url,
    organisation_id,
    emergency_contact_name,
    emergency_contact_phone,
    medical_conditions,
    primary_language,
    mobility_restricted,
    home_lat,
    home_lng,
  } = body || {};

  if (!full_name || !phone_number || !password || !role) {
    throw new AppError(400, 'VALIDATION_ERROR', 'full_name, phone_number, password, and role are required');
  }
  if (!ALLOWED_REGISTER_ROLES.includes(role)) {
    throw new AppError(400, 'VALIDATION_ERROR', `role must be one of: ${ALLOWED_REGISTER_ROLES.join(', ')}`);
  }
  if (ward_number === undefined || ward_number === null || address === undefined || address === '') {
    throw new AppError(400, 'VALIDATION_ERROR', 'ward_number and address are required');
  }
  if (role === constants.ROLES.POLICE_ADMIN && invite_code !== env.policeAdminInviteCode) {
    throw new AppError(403, 'FORBIDDEN', 'Valid invite_code is required to register as POLICE_ADMIN');
  }
  if (role === constants.ROLES.VOLUNTEER && (!id_proof_type || !id_proof_number || !id_document_url)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'id_proof_type, id_proof_number and id_document_url are required for VOLUNTEER registration'
    );
  }
  if (
    role === constants.ROLES.SENIOR &&
    (!emergency_contact_name || !emergency_contact_phone || home_lat === undefined || home_lng === undefined)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'emergency_contact_name, emergency_contact_phone, home_lat and home_lng are required for SENIOR registration'
    );
  }

  return withTransaction(async (client) => {
    const existing = await userModel.findByPhone(phone_number, client);
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'Phone number already registered');
    }

    const password_hash = await hashPassword(password);
    const user = await userModel.create(
      {
        full_name,
        phone_number,
        password_hash,
        role,
        ward_number: Number(ward_number),
        address,
      },
      client
    );

    let volunteer_profile = null;
    let senior_profile = null;

    if (role === constants.ROLES.VOLUNTEER) {
      const profile = await volunteerModel.create(
        { user_id: user.id, organisation_id, id_proof_type, id_proof_number, id_document_url },
        client
      );
      volunteer_profile = volunteerModel.publicVolunteer(profile);
    }

    if (role === constants.ROLES.SENIOR) {
      const profile = await seniorModel.create(
        {
          user_id: user.id,
          primary_language,
          emergency_contact_name,
          emergency_contact_phone,
          medical_conditions,
          mobility_restricted,
          home_lat: Number(home_lat),
          home_lng: Number(home_lng),
        },
        client
      );
      senior_profile = seniorModel.publicSenior({ ...profile, ...user }, { includeMedical: true });
    }

    await writeAudit(client, {
      actorId: user.id,
      action: 'USER_REGISTERED',
      targetResource: 'users',
      targetId: user.id,
      req,
      details: { role, phone_number },
    });

    return {
      user: userModel.publicUser(user),
      volunteer_profile,
      senior_profile,
    };
  });
}

async function issueSession(user, res) {
  const sessionId = randomId();
  const access_token = signAccessToken(user);
  const refresh_token = signRefreshToken(user, sessionId);
  await refreshModel.create({
    userId: user.id,
    tokenHash: hashToken(refresh_token),
    expiresAt: parseRefreshExpiryDate(),
  });
  if (res) setRefreshCookie(res, refresh_token);
  return {
    token: access_token,
    access_token,
    refresh_token,
    token_type: 'Bearer',
    expires_in: env.jwtAccessExpiresIn,
    user: userModel.publicUser(user),
  };
}

async function login(body, res) {
  const { phone_number, password } = body || {};
  if (!phone_number || !password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'phone_number and password are required');
  }
  const user = await userModel.findByPhone(phone_number);
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid phone number or password');
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid phone number or password');
  }
  if (user.is_active === false) {
    throw new AppError(403, 'FORBIDDEN', 'Account is inactive');
  }
  return issueSession(user, res);
}

async function refresh(req, res) {
  const token = req.cookies?.refresh_token || req.body?.refresh_token;
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token missing');
  }
  let payload;
  try {
    payload = verifyToken(token);
  } catch (_err) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid refresh token');
  }
  if (payload.typ !== 'refresh') {
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token required');
  }
  const session = await refreshModel.findValid(hashToken(token));
  if (!session) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh session revoked or expired');
  }
  const user = await userModel.findById(payload.userId);
  if (!user || user.is_active === false) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Account unavailable');
  }
  await refreshModel.revoke(hashToken(token));
  return issueSession(user, res);
}

async function logout(req) {
  const token = req.cookies?.refresh_token || req.body?.refresh_token;
  if (token) await refreshModel.revoke(hashToken(token));
}

async function me(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'User not found');
  const volunteer_profile = volunteerModel.publicVolunteer(await volunteerModel.findByUserId(userId));
  const seniorRow = await seniorModel.findByUserId(userId);
  const senior_profile = seniorModel.publicSenior(seniorRow, { includeMedical: true });
  return { user: userModel.publicUser(user), volunteer_profile, senior_profile };
}

module.exports = { register, login, refresh, logout, me };
