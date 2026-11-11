const express = require('express');
const { authenticate, requireRoles, verifyWebhookSignature } = require('../middlewares/auth');
const { requireUuidParam } = require('../middlewares/validate');
const { list, acknowledge, inboundWebhook } = require('../controllers/emergency.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.post('/voice/inbound-webhook', verifyWebhookSignature, inboundWebhook);

router.get('/emergencies', authenticate, requireRoles([ROLES.POLICE_ADMIN]), list);
router.patch(
  '/emergencies/:id/acknowledge',
  authenticate,
  requireRoles([ROLES.POLICE_ADMIN]),
  requireUuidParam('id'),
  acknowledge
);

module.exports = router;
