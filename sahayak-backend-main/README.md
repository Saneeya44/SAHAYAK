# SAHAYAK Backend

Community Assistance & Emergency Dispatch API for **Shirva Police Station (PS-03, Udupi District, Karnataka Police)**.

The backend is split into controllers, services, models, and middlewares so judges can inspect each workflow (volunteer verification, optimistic request acceptance, 112 escalation, immutable audit logs, senior SOS, beat patrol, citizen incident tracking) without reading a single dump file.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js + Express 5 |
| Database | PostgreSQL 16 + pgcrypto (PostGIS when available) |
| Auth | JWT HS256 access token (15m) + refresh token (7d, HttpOnly cookie **and** JSON for Postman) |
| Passwords | bcryptjs, 12 rounds |
| Station | `PS-03-SHIRVA` |

Redis/BullMQ is specified in the design for a dead-man switch. This implementation runs the same **20-minute inactivity revert** on an in-process timer plus `POST /api/v1/dashboard/dead-man-switch` so the demo works without Redis.

## Folder structure

```
src/
  config/         env, constants, db pool, schema/migrations
  models/         table access for every blueprint entity + patrol/incidents/alerts
  services/       business rules (BR-01 … BR-05, ERSS 112, GIS context)
  controllers/    HTTP handlers
  routes/         /api/v1 grouped by entity
  middlewares/    JWT, RBAC, validation, logging, rate limit, errors
  utils/          JWT, hashing, geo, response envelope
  scripts/seed.js demo Shirva users
  app.js          Express app
  server.js       entry point
tests/run-flows.js
```

## Database entities (blueprint)

- `users`
- `volunteer_profiles`
- `senior_profiles` (medical fields encrypted with pgcrypto)
- `service_requests` (`version` optimistic lock)
- `emergency_112_logs`
- `audit_logs` (append-only trigger `trg_protect_audit_logs`)

Extra operational tables (hackathon demo, not replacing the blueprint):

- `citizen_incidents` (public tracking IDs `SHV-YYMMDD-XXXX`)
- `beat_patrol_logs` (welfare check-ins for seniors living alone)
- `police_alerts` (SOS queue, dead-man alerts, low-confidence voice)
- `refresh_sessions`

## Setup

```bash
npm install
cp .env.example .env
# set DATABASE_URL, JWT_SECRET, MEDICAL_ENCRYPTION_KEY, WEBHOOK_SIGNING_SECRET
npm run seed
npm run dev
```

Health check: `GET http://localhost:3000/health`

### Demo accounts (`npm run seed`)

| Role | Phone | Password |
| --- | --- | --- |
| POLICE_ADMIN | 9000000001 | Admin@123 |
| WARD_AGENT | 9000000002 | Ward@123 |
| SENIOR | 9000000003 | Senior@123 |
| VOLUNTEER | 9000000004 | Volunteer@123 |

Police-admin self-registration also requires `invite_code` = `SHIRVA-PS-03` (or `POLICE_ADMIN_INVITE_CODE`).

## Response shape

Success:

```json
{ "success": true, "message": "...", "data": {} }
```

Error:

```json
{ "success": false, "error": { "code": "RESOURCE_NOT_FOUND", "message": "..." } }
```

Status codes: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `429`, `500`.

---

## API endpoint table

Auth header for protected routes: `Authorization: Bearer <access_token>`.

| ID | Method | Route | Auth / role | Body | Success |
| --- | --- | --- | --- | --- | --- |
| API-01 | POST | `/api/v1/auth/register` | Public | See register examples below | `201` user (+ senior/volunteer profile) |
| API-02 | POST | `/api/v1/auth/login` | Public | `{ phone_number, password }` | `200` `{ token, refresh_token, user }` |
| — | POST | `/api/v1/auth/refresh` | Cookie or body `refresh_token` | `{ refresh_token }` | `200` new tokens |
| — | POST | `/api/v1/auth/logout` | Optional | `{ refresh_token }` | `200` |
| — | GET | `/api/v1/auth/me` | JWT | — | `200` user + profiles |
| API-03 | GET | `/api/v1/volunteers?status=&ward_number=` | POLICE_ADMIN, WARD_AGENT | — | `200` list |
| API-04 | PATCH | `/api/v1/volunteers/:id/verify` | POLICE_ADMIN | `{ verification_status }` | `200` profile |
| — | GET | `/api/v1/volunteers/me` | VOLUNTEER | — | `200` |
| — | PATCH | `/api/v1/volunteers/me/location` | VOLUNTEER | `{ latitude, longitude }` | `200` |
| — | GET | `/api/v1/seniors` | POLICE_ADMIN, WARD_AGENT | — | `200` |
| — | GET | `/api/v1/seniors/:id` | Owner / assigned volunteer / staff | — | `200` (medical if authorised) |
| — | PATCH | `/api/v1/seniors/me` | SENIOR | profile fields | `200` |
| API-05 | POST | `/api/v1/requests` | SENIOR, POLICE_ADMIN, WARD_AGENT | `{ category, description, latitude, longitude, idempotency_key, senior_id? }` | `201` |
| — | GET | `/api/v1/requests` | JWT | query `status`, `mine=true` | `200` |
| — | GET | `/api/v1/requests/:id` | JWT | — | `200` |
| API-06 | PATCH | `/api/v1/requests/:id/accept` | VOLUNTEER (VERIFIED/ACTIVE) | `{ version }` | `200` `{ request_id, status: ASSIGNED, version }` or `409` |
| — | PATCH | `/api/v1/requests/:id/start` | Assigned volunteer | — | `200` IN_PROGRESS |
| — | PATCH | `/api/v1/requests/:id/complete` | Assigned volunteer | — | `200` COMPLETED |
| — | PATCH | `/api/v1/requests/:id/cancel` | Senior / volunteer / admin | — | `200` CANCELLED |
| API-07 | POST | `/api/v1/requests/:id/escalate` | JWT | `{ reason, escalation_source, idempotency_key }` | `201` `{ emergency_log_id, status: ESCALATED_112 }` |
| — | POST | `/api/v1/requests/sos` | SENIOR, POLICE_ADMIN | SOS + 112 in one call | `201` |
| API-08 | POST | `/api/v1/voice/inbound-webhook` | Header `X-Sahayak-Signature` | voice payload | `201` |
| API-09 | GET | `/api/v1/incidents/:id/context` | POLICE_ADMIN | — | `200` radar + signed CCTV + 3D viewport |
| — | POST | `/api/v1/incidents` | JWT | citizen report | `201` `{ tracking_id }` |
| — | GET | `/api/v1/incidents` | JWT | — | `200` |
| — | GET | `/api/v1/incidents/:trackingId` | Owner or staff | — | `200` |
| — | PATCH | `/api/v1/incidents/:trackingId` | POLICE_ADMIN, WARD_AGENT | `{ status, resolution_notes }` | `200` |
| — | POST | `/api/v1/patrols/checkin` | POLICE_ADMIN, WARD_AGENT | `{ senior_id, condition_ok, notes, latitude, longitude }` | `201` |
| — | GET | `/api/v1/patrols?today=true` | Staff | — | `200` |
| — | GET | `/api/v1/dashboard` | POLICE_ADMIN | — | `200` SOS queue, patrols, pending requests |
| — | GET | `/api/v1/dashboard/audit` | POLICE_ADMIN | — | `200` |
| — | POST | `/api/v1/dashboard/dead-man-switch` | POLICE_ADMIN | — | `200` force BG-01 |
| — | GET | `/api/v1/emergencies?unacked=true` | POLICE_ADMIN | — | `200` |
| — | PATCH | `/api/v1/emergencies/:id/acknowledge` | POLICE_ADMIN | — | `200` POLICE_DISPATCHED |

---

## Postman: test every flow (no frontend)

Set collection variables: `base = http://localhost:3000`, `adminToken`, `seniorToken`, `volToken`.

### 0. Health

`GET {{base}}/health`

### 1. Login (repeat for each demo user)

`POST {{base}}/api/v1/auth/login`

```json
{ "phone_number": "9000000001", "password": "Admin@123" }
```

Copy `data.token` into `adminToken`. Repeat for senior `9000000003` / `Senior@123` and volunteer `9000000004` / `Volunteer@123`.

### 2. T-01 Volunteer verification

`GET {{base}}/api/v1/volunteers`  
Header: `Authorization: Bearer {{adminToken}}`

Copy volunteer `id`. Then in order:

```http
PATCH /api/v1/volunteers/{{volunteerId}}/verify
{ "verification_status": "UNDER_REVIEW" }

PATCH /api/v1/volunteers/{{volunteerId}}/verify
{ "verification_status": "VERIFIED" }

PATCH /api/v1/volunteers/{{volunteerId}}/verify
{ "verification_status": "ACTIVE" }
```

Invalid jump (e.g. REGISTERED → ACTIVE) returns `409`.

### 3. T-02 Verification authorization

Same verify call with `seniorToken` → **403**, volunteer status unchanged.

### 4. T-03 Concurrent acceptance (BR-02)

Senior creates a request:

```http
POST /api/v1/requests
Authorization: Bearer {{seniorToken}}

{
  "category": "MEDICINE",
  "description": "Need BP tablets from Shirva pharmacy",
  "latitude": 13.2435,
  "longitude": 74.8021
}
```

Note `data.request.id` and `data.request.version` (usually `0`).

Volunteer A:

```http
PATCH /api/v1/requests/{{requestId}}/accept
{ "version": 0 }
```

Expect `200` and `status: ASSIGNED`, `version: 1`.

Volunteer B (or same token, same `version: 0` again):

Expect **409 CONFLICT**.

Unverified volunteer accept → **403** (BR-01).

### 5. Senior SOS + medical profile (APP)

```http
POST /api/v1/requests/sos
Authorization: Bearer {{seniorToken}}

{
  "category": "SOS_MEDICAL",
  "description": "Chest pain, living alone, Ward 3",
  "latitude": 13.2435,
  "longitude": 74.8021,
  "idempotency_key": "sos-demo-001"
}
```

Expect `201` with `emergency_112_logs` payload + `dispatch_payload` for ERSS 112 (`station_id: PS-03-SHIRVA`). Repeat the same `idempotency_key` → no duplicate dispatch (T-07).

Police dashboard: `GET /api/v1/dashboard` with admin token — SOS queue, pending requests, patrols.

### 6. T-04 / T-06 Voice webhook (confidence &lt; 0.60)

```http
POST /api/v1/voice/inbound-webhook
X-Sahayak-Signature: <WEBHOOK_SIGNING_SECRET from .env>

{
  "phone_number": "9000000003",
  "transcription_text": "Kannada: Emergency help needed at Shirva Market Road",
  "transcription_confidence": 0.42,
  "dialect_detected": "kannada",
  "raw_audio_url": "https://storage.sahayak.gov.in/audio/sos-8831.wav",
  "idempotency_key": "voice-8831",
  "source": "VOICE"
}
```

Expect `human_fallback_triggered: true` and a police alert `VOICE_HUMAN_FALLBACK`. Confidence `0.91` should not set fallback.

Missing/invalid signature → **401**.

### 7. T-05 Dead-man switch

Accept a request and do **not** call `/start`. Either wait 20 minutes or, for the demo:

```http
POST /api/v1/dashboard/dead-man-switch
Authorization: Bearer {{adminToken}}
```

To force immediately in SQL (TablePlus / psql):

```sql
UPDATE service_requests
SET assigned_at = NOW() - INTERVAL '21 minutes'
WHERE status = 'ASSIGNED';
```

Then hit the dead-man endpoint. Expect request `PENDING`, volunteer `trust_score - 5`, police alert created.

### 8. T-08 Audit immutability

`GET /api/v1/dashboard/audit`

In the DB GUI:

```sql
UPDATE audit_logs SET action = 'TAMPER' WHERE id = '<any id>';
DELETE FROM audit_logs WHERE id = '<any id>';
```

PostgreSQL must raise: *Audit logs are immutable...*

### 9. T-09 Encrypted medical data

Register/seed senior stores `medical_conditions_encrypted` as `bytea`. In the GUI the column is not plaintext. `GET /api/v1/seniors/:userId` as police admin returns decrypted `medical_conditions`. A random volunteer without an assignment → **403**.

### 10. T-10 GIS incident context

After a request or SOS exists:

```http
GET /api/v1/incidents/{{requestId}}/context
Authorization: Bearer {{adminToken}}
```

Response includes volunteer radar, signed CCTV URL (5-minute TTL), and on-demand 3D viewport (`CesiumJS` look-at). Ping volunteer GPS first:

```http
PATCH /api/v1/volunteers/me/location
{ "latitude": 13.2440, "longitude": 74.8015 }
```

### 11. Citizen incident tracking ID

```http
POST /api/v1/incidents
Authorization: Bearer {{seniorToken}}

{
  "category": "THEFT",
  "description": "Purse snatched near Shirva bus stand",
  "latitude": 13.2438,
  "longitude": 74.8025,
  "ward_number": 3
}
```

Copy `tracking_id` (e.g. `SHV-260923-AB12`). Track with `GET /api/v1/incidents/{{tracking_id}}`. Police updates status with PATCH.

### 12. Beat patrol check-in (seniors living alone)

```http
POST /api/v1/patrols/checkin
Authorization: Bearer {{adminToken}}

{
  "senior_id": "<senior user UUID>",
  "condition_ok": true,
  "notes": "Tea shared, BP medicine taken, no distress",
  "latitude": 13.2435,
  "longitude": 74.8021
}
```

`GET /api/v1/patrols?today=true` feeds the dashboard `active_patrol_logs`.

### 13. Register a new senior (optional)

```json
{
  "full_name": "Gopal Bangera",
  "phone_number": "9000000099",
  "password": "Senior@123",
  "role": "SENIOR",
  "ward_number": 2,
  "address": "Moodubelle Road, Shirva",
  "emergency_contact_name": "Divya Bangera",
  "emergency_contact_phone": "9111111100",
  "home_lat": 13.25,
  "home_lng": 74.81,
  "medical_conditions": "Asthma",
  "primary_language": "kannada",
  "mobility_restricted": false
}
```

Volunteer registration also needs `id_proof_type`, `id_proof_number`, `id_document_url`.

---

## Business rules wired in code

| ID | Rule |
| --- | --- |
| BR-01 | Accept / senior PII only if volunteer `VERIFIED` or `ACTIVE` |
| BR-02 | `UPDATE ... WHERE id=? AND version=? AND status='PENDING'`; else 409 |
| BR-03 | `transcription_confidence < 0.60` ⇒ `human_fallback_triggered` |
| BR-04 | 20 min stale ASSIGNED → PENDING, trust −5, police alert |
| BR-05 | Trigger blocks UPDATE/DELETE on `audit_logs` |

Volunteer state: `REGISTERED → UNDER_REVIEW → VERIFIED → ACTIVE` (reject/suspend supported).  
Request state: `PENDING → ASSIGNED → IN_PROGRESS → COMPLETED` with `CANCELLED` and `ESCALATED_112 → POLICE_DISPATCHED`.

## Environment

See `.env.example`. Enable PostGIS on the database for native `GEOGRAPHY(Point, 4326)` columns; otherwise latitude/longitude columns still power dispatch and radar (Haversine fallback).
