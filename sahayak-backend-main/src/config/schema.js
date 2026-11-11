const { pool } = require('./db');

async function tryExtension(client, name) {
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "${name}"`);
    return true;
  } catch (err) {
    console.warn(`[schema] extension ${name} not available: ${err.message}`);
    return false;
  }
}

async function createEnum(client, typeName, values) {
  const list = values.map((v) => `'${v}'`).join(', ');
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE ${typeName} AS ENUM (${list});
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

function triggerExecuteClause() {
  return 'EXECUTE FUNCTION prevent_audit_tampering()';
}

async function initSchema() {
  const client = await pool.connect();
  try {
    const hasPgcrypto = await tryExtension(client, 'pgcrypto');
    if (!hasPgcrypto) {
      throw new Error('pgcrypto extension is required');
    }
    await tryExtension(client, 'uuid-ossp');
    const hasPostgis = await tryExtension(client, 'postgis');

    await client.query('BEGIN');

    await createEnum(client, 'user_role', ['SENIOR', 'VOLUNTEER', 'POLICE_ADMIN', 'WARD_AGENT']);
    await createEnum(client, 'verification_state', [
      'REGISTERED',
      'UNDER_REVIEW',
      'VERIFIED',
      'ACTIVE',
      'REJECTED',
      'SUSPENDED',
    ]);
    await createEnum(client, 'request_status', [
      'PENDING',
      'ASSIGNED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'ESCALATED_112',
      'POLICE_DISPATCHED',
    ]);
    await createEnum(client, 'threat_level', ['LOW', 'MEDIUM', 'HIGH', 'HIGH_CRITICAL_RED']);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(15) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('SENIOR', 'VOLUNTEER', 'POLICE_ADMIN', 'WARD_AGENT')),
        ward_number INT NOT NULL DEFAULT 0,
        address TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE users ALTER COLUMN ward_number SET DEFAULT 0`);
    await client.query(`ALTER TABLE users ALTER COLUMN address SET DEFAULT ''`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS volunteer_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id),
        organisation_id UUID,
        id_proof_type VARCHAR(50) NOT NULL DEFAULT 'AADHAAR',
        id_proof_number VARCHAR(100) NOT NULL DEFAULT '',
        id_document_url TEXT NOT NULL DEFAULT '',
        verification_status VARCHAR(20) DEFAULT 'REGISTERED'
          CHECK (verification_status IN ('REGISTERED', 'UNDER_REVIEW', 'VERIFIED', 'ACTIVE', 'REJECTED', 'SUSPENDED')),
        verified_by_police_id UUID REFERENCES users(id),
        trust_score INT DEFAULT 10,
        nss_ncc_points INT DEFAULT 0,
        badge_title VARCHAR(50) DEFAULT 'Novice Guardian',
        last_known_lat DOUBLE PRECISION,
        last_known_lng DOUBLE PRECISION,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const volunteerAlters = [
      `ALTER TABLE volunteer_profiles ADD COLUMN IF NOT EXISTS organisation_id UUID`,
      `ALTER TABLE volunteer_profiles ADD COLUMN IF NOT EXISTS id_document_url TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE volunteer_profiles ADD COLUMN IF NOT EXISTS verified_by_police_id UUID REFERENCES users(id)`,
      `ALTER TABLE volunteer_profiles ADD COLUMN IF NOT EXISTS nss_ncc_points INT DEFAULT 0`,
      `ALTER TABLE volunteer_profiles ADD COLUMN IF NOT EXISTS last_known_lat DOUBLE PRECISION`,
      `ALTER TABLE volunteer_profiles ADD COLUMN IF NOT EXISTS last_known_lng DOUBLE PRECISION`,
      `ALTER TABLE volunteer_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
    ];
    for (const sql of volunteerAlters) {
      await client.query(sql);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS senior_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id),
        primary_language VARCHAR(20) DEFAULT 'kannada',
        emergency_contact_name VARCHAR(100) NOT NULL,
        emergency_contact_phone VARCHAR(15) NOT NULL,
        medical_conditions_encrypted BYTEA,
        mobility_restricted BOOLEAN DEFAULT FALSE,
        home_lat DOUBLE PRECISION NOT NULL DEFAULT 13.2435,
        home_lng DOUBLE PRECISION NOT NULL DEFAULT 74.8021,
        consent_given_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        data_retention_expires_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS service_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        senior_id UUID NOT NULL REFERENCES users(id),
        assigned_volunteer_id UUID REFERENCES users(id),
        category VARCHAR(50) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status VARCHAR(30) DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ESCALATED_112', 'POLICE_DISPATCHED')),
        location_lat DOUBLE PRECISION NOT NULL DEFAULT 13.2435,
        location_lng DOUBLE PRECISION NOT NULL DEFAULT 74.8021,
        idempotency_key VARCHAR(100) UNIQUE,
        version INT DEFAULT 0,
        assigned_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const requestAlters = [
      `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION NOT NULL DEFAULT 13.2435`,
      `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION NOT NULL DEFAULT 74.8021`,
      `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100)`,
      `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ`,
      `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`,
      `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
    ];
    for (const sql of requestAlters) {
      await client.query(sql);
    }
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_service_requests_idempotency
      ON service_requests (idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS emergency_112_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID REFERENCES service_requests(id),
        triggered_by_user_id UUID NOT NULL REFERENCES users(id),
        threat_flag VARCHAR(30) DEFAULT 'HIGH_CRITICAL_RED'
          CHECK (threat_flag IN ('LOW', 'MEDIUM', 'HIGH', 'HIGH_CRITICAL_RED')),
        escalation_reason TEXT NOT NULL,
        escalation_source VARCHAR(20) DEFAULT 'APP'
          CHECK (escalation_source IN ('VOICE', 'APP', 'WHATSAPP', 'IVR', 'SMS')),
        raw_audio_url TEXT,
        transcription_text TEXT,
        transcription_confidence NUMERIC(4,3),
        dialect_detected VARCHAR(50),
        human_fallback_triggered BOOLEAN DEFAULT FALSE,
        idempotency_key VARCHAR(100) UNIQUE,
        external_112_reference_id VARCHAR(100),
        dispatched_unit_id VARCHAR(100),
        police_response_time_seconds INT,
        closure_report TEXT,
        dispatch_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        api_response_code INT NOT NULL DEFAULT 0,
        acknowledged_by_police BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID NOT NULL REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        target_resource VARCHAR(100) NOT NULL,
        target_id UUID,
        ip_address VARCHAR(45) NOT NULL DEFAULT '0.0.0.0',
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id UUID`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NOT NULL DEFAULT '0.0.0.0'`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS citizen_incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tracking_id VARCHAR(30) NOT NULL UNIQUE,
        reporter_id UUID NOT NULL REFERENCES users(id),
        category VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
          CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'ASSIGNED', 'RESOLVED', 'CLOSED')),
        ward_number INT,
        location_lat DOUBLE PRECISION NOT NULL,
        location_lng DOUBLE PRECISION NOT NULL,
        assigned_officer_id UUID REFERENCES users(id),
        resolution_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS beat_patrol_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        senior_id UUID NOT NULL REFERENCES users(id),
        officer_id UUID NOT NULL REFERENCES users(id),
        ward_number INT,
        condition_ok BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT,
        checkin_lat DOUBLE PRECISION,
        checkin_lng DOUBLE PRECISION,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS police_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'HIGH',
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        related_request_id UUID REFERENCES service_requests(id),
        related_user_id UUID REFERENCES users(id),
        is_acknowledged BOOLEAN DEFAULT FALSE,
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (hasPostgis) {
      await client.query(`ALTER TABLE volunteer_profiles ADD COLUMN IF NOT EXISTS last_known_location GEOGRAPHY(Point, 4326)`);
      await client.query(`ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS home_location GEOGRAPHY(Point, 4326)`);
      await client.query(`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326)`);
      await client.query(`ALTER TABLE citizen_incidents ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326)`);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_volunteer_last_known_gix
        ON volunteer_profiles USING GIST (last_known_location)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_senior_home_gix
        ON senior_profiles USING GIST (home_location)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_request_location_gix
        ON service_requests USING GIST (location)
      `);
    }

    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_tampering()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly forbidden.';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query('DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs');
    await client.query('DROP TRIGGER IF EXISTS trg_protect_audit_logs ON audit_logs');

    try {
      await client.query(`
        CREATE TRIGGER trg_protect_audit_logs
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW
        ${triggerExecuteClause()}
      `);
    } catch (_err) {
      await client.query(`
        CREATE TRIGGER trg_protect_audit_logs
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW
        EXECUTE PROCEDURE prevent_audit_tampering()
      `);
    }

    await client.query(`ALTER TABLE service_requests ALTER COLUMN status TYPE VARCHAR(30)`);
    await client.query(`ALTER TABLE volunteer_profiles DROP CONSTRAINT IF EXISTS volunteer_profiles_verification_status_check`);
    try {
      await client.query(`
        ALTER TABLE volunteer_profiles ADD CONSTRAINT volunteer_profiles_verification_status_check
        CHECK (verification_status IN ('REGISTERED', 'UNDER_REVIEW', 'VERIFIED', 'ACTIVE', 'REJECTED', 'SUSPENDED'))
      `);
    } catch (err) {
      if (err.code !== '42710') throw err;
    }
    await client.query(`ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check`);
    try {
      await client.query(`
        ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check
        CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ESCALATED_112', 'POLICE_DISPATCHED'))
      `);
    } catch (err) {
      if (err.code !== '42710') throw err;
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users (phone_number);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
      CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_user_id ON volunteer_profiles (user_id);
      CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_status ON volunteer_profiles (verification_status);
      CREATE INDEX IF NOT EXISTS idx_senior_profiles_user_id ON senior_profiles (user_id);
      CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests (status);
      CREATE INDEX IF NOT EXISTS idx_service_requests_senior_id ON service_requests (senior_id);
      CREATE INDEX IF NOT EXISTS idx_emergency_request_id ON emergency_112_logs (request_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
      CREATE INDEX IF NOT EXISTS idx_citizen_incidents_tracking ON citizen_incidents (tracking_id);
      CREATE INDEX IF NOT EXISTS idx_citizen_incidents_status ON citizen_incidents (status);
      CREATE INDEX IF NOT EXISTS idx_beat_patrol_senior ON beat_patrol_logs (senior_id);
      CREATE INDEX IF NOT EXISTS idx_police_alerts_ack ON police_alerts (is_acknowledged);
    `);

    await client.query('COMMIT');
    return { hasPostgis };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initSchema };
