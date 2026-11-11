const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { requestLogger } = require('./middlewares/requestLogger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { rateLimit } = require('./middlewares/rateLimit');
const apiRouter = require('./routes');
const constants = require('./config/constants');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(rateLimit({ windowMs: 60_000, max: 120, keyPrefix: 'global' }));

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      service: 'SAHAYAK',
      station: constants.STATION,
      message: 'Community Assistance & Emergency Dispatch API',
    });
  });

  app.use('/api/v1', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
