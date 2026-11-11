require('dotenv').config();

const { initSchema } = require('../config/schema');
const { withTransaction } = require('../config/db');
const { hashPassword } = require('../utils/password');
const userModel = require('../models/user.model');
const volunteerModel = require('../models/volunteerProfile.model');
const seniorModel = require('../models/seniorProfile.model');

const DEMO = [
  {
    full_name: 'Inspector Ramesh Nayak',
    phone_number: '9000000001',
    password: 'Admin@123',
    role: 'POLICE_ADMIN',
    ward_number: 1,
    address: 'Shirva Police Station, Udupi',
  },
  {
    full_name: 'Ward Agent Latha Shetty',
    phone_number: '9000000002',
    password: 'Ward@123',
    role: 'WARD_AGENT',
    ward_number: 3,
    address: 'Ward 3 Office, Shirva',
  },
  {
    full_name: 'Kamala Poojary',
    phone_number: '9000000003',
    password: 'Senior@123',
    role: 'SENIOR',
    ward_number: 3,
    address: 'Market Road, Shirva',
    senior: {
      emergency_contact_name: 'Anitha Poojary',
      emergency_contact_phone: '9111111111',
      medical_conditions: 'Hypertension; diabetes mellitus type 2',
      mobility_restricted: true,
      primary_language: 'tulu',
      home_lat: 13.2435,
      home_lng: 74.8021,
    },
  },
  {
    full_name: 'Volunteer Arun DSouza',
    phone_number: '9000000004',
    password: 'Volunteer@123',
    role: 'VOLUNTEER',
    ward_number: 3,
    address: 'Near St. Mary Church, Shirva',
    volunteer: {
      id_proof_type: 'AADHAAR',
      id_proof_number: 'XXXX-XXXX-4421',
      id_document_url: 'https://storage.sahayak.gov.in/id/arun.pdf',
    },
  },
];

async function seed() {
  await initSchema();
  await withTransaction(async (client) => {
    for (const row of DEMO) {
      const existing = await userModel.findByPhone(row.phone_number, client);
      if (existing) {
        if (row.volunteer) {
          const vp = await volunteerModel.findByUserId(existing.id, client);
          if (!vp) {
            await volunteerModel.create({ user_id: existing.id, ...row.volunteer }, client);
          } else {
            await volunteerModel.updateVerification(vp.id, { verification_status: 'REGISTERED', verified_by_police_id: null }, client);
          }
        }
        if (row.senior) {
          const sp = await seniorModel.findByUserId(existing.id, client);
          if (!sp) await seniorModel.create({ user_id: existing.id, ...row.senior }, client);
        }
        console.log(`reset/skip ${row.phone_number} (${row.role})`);
        continue;
      }
      const user = await userModel.create(
        {
          full_name: row.full_name,
          phone_number: row.phone_number,
          password_hash: await hashPassword(row.password),
          role: row.role,
          ward_number: row.ward_number,
          address: row.address,
        },
        client
      );
      if (row.volunteer) {
        await volunteerModel.create({ user_id: user.id, ...row.volunteer }, client);
      }
      if (row.senior) {
        await seniorModel.create({ user_id: user.id, ...row.senior }, client);
      }
      console.log(`created ${row.role} ${row.phone_number} / ${row.password}`);
    }
  });
  console.log('Seed complete.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
