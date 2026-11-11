const express = require('express');
const { authenticate, requireRoles } = require('../middlewares/auth');
const { overview, ackAlert, audit, runDeadMan } = require('../controllers/dashboard.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate, requireRoles([ROLES.POLICE_ADMIN]));

router.get('/', overview);
router.get('/audit', audit);
router.post('/dead-man-switch', runDeadMan);
router.patch('/alerts/:id/acknowledge', ackAlert);

module.exports = router;
