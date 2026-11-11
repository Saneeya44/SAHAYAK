/**
 * Lightweight flow runner for local/Postman-less smoke checks.
 * Usage: npm test
 * Requires the API to be running (npm run dev) and DATABASE seeded (npm run seed).
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const health = await call('GET', '/health');
  assert(health.status === 200 && health.json.success, 'health failed');

  const adminLogin = await call('POST', '/api/v1/auth/login', {
    body: { phone_number: '9000000001', password: 'Admin@123' },
  });
  assert(adminLogin.status === 200, `admin login failed: ${JSON.stringify(adminLogin.json)}`);
  const adminToken = adminLogin.json.data.token;

  const seniorLogin = await call('POST', '/api/v1/auth/login', {
    body: { phone_number: '9000000003', password: 'Senior@123' },
  });
  assert(seniorLogin.status === 200, 'senior login failed');
  const seniorToken = seniorLogin.json.data.token;

  const volLogin = await call('POST', '/api/v1/auth/login', {
    body: { phone_number: '9000000004', password: 'Volunteer@123' },
  });
  assert(volLogin.status === 200, 'volunteer login failed');
  const volToken = volLogin.json.data.token;

  const volunteers = await call('GET', '/api/v1/volunteers', { token: adminToken });
  assert(volunteers.status === 200, 'list volunteers failed');
  const volunteer = volunteers.json.data.find(v => v.verification_status === 'REGISTERED') || volunteers.json.data[0];
  const volunteerId = volunteer.id;

  if (volunteer.verification_status === 'REGISTERED') {
    const underReview = await call('PATCH', `/api/v1/volunteers/${volunteerId}/verify`, {
      token: adminToken,
      body: { verification_status: 'UNDER_REVIEW' },
    });
    assert(underReview.status === 200, `verify UNDER_REVIEW failed ${JSON.stringify(underReview.json)}`);

    const verified = await call('PATCH', `/api/v1/volunteers/${volunteerId}/verify`, {
      token: adminToken,
      body: { verification_status: 'VERIFIED' },
    });
    assert(verified.status === 200, 'verify VERIFIED failed');
  } else if (volunteer.verification_status === 'UNDER_REVIEW') {
    const verified = await call('PATCH', `/api/v1/volunteers/${volunteerId}/verify`, {
      token: adminToken,
      body: { verification_status: 'VERIFIED' },
    });
    assert(verified.status === 200, 'verify VERIFIED failed');
  }

  const forbidden = await call('PATCH', `/api/v1/volunteers/${volunteerId}/verify`, {
    token: seniorToken,
    body: { verification_status: 'ACTIVE' },
  });
  assert(forbidden.status === 403, 'unprivileged verify should 403');

  const created = await call('POST', '/api/v1/requests', {
    token: seniorToken,
    body: {
      category: 'MEDICINE',
      description: 'Need blood-pressure tablets from Shirva pharmacy',
      latitude: 13.2435,
      longitude: 74.8021,
    },
  });
  assert(created.status === 201, `create request failed ${JSON.stringify(created.json)}`);
  const requestId = created.json.data.request.id;
  const version = created.json.data.request.version;

  const accept = await call('PATCH', `/api/v1/requests/${requestId}/accept`, {
    token: volToken,
    body: { version },
  });
  assert(accept.status === 200, `accept failed ${JSON.stringify(accept.json)}`);

  const conflict = await call('PATCH', `/api/v1/requests/${requestId}/accept`, {
    token: volToken,
    body: { version },
  });
  assert(conflict.status === 409, 'second accept should 409');

  const dash = await call('GET', '/api/v1/dashboard', { token: adminToken });
  assert(dash.status === 200, 'dashboard failed');

  console.log('All smoke flows passed.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
