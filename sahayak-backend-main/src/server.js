require('dotenv').config();

const env = require('./config/env');
const { initSchema } = require('./config/schema');
const { createApp } = require('./app');
const { startDeadManLoop } = require('./services/deadManSwitch.service');

const app = createApp();

async function start() {
  const schema = await initSchema();
  startDeadManLoop();
  app.listen(env.port, () => {
    console.log(`SAHAYAK API listening on port ${env.port}`);
    console.log(`Station ${env.stationCode} | PostGIS ${schema.hasPostgis ? 'enabled' : 'lat/lng fallback'}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start SAHAYAK API', err);
    process.exit(1);
  });
}

module.exports = app;
