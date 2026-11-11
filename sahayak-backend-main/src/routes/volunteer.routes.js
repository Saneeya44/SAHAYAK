const express = require('express');
const { authenticate, requireRoles } = require('../middlewares/auth');
const { requireUuidParam } = require('../middlewares/validate');
const { list, verify, pingLocation, getMine } = require('../controllers/volunteer.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate);

router.get('/me', requireRoles([ROLES.VOLUNTEER]), getMine);
router.patch('/me/location', requireRoles([ROLES.VOLUNTEER]), pingLocation);
router.get('/', requireRoles([ROLES.POLICE_ADMIN, ROLES.WARD_AGENT]), list);
router.patch('/:id/verify', requireRoles([ROLES.POLICE_ADMIN]), requireUuidParam('id'), verify);

module.exports = router;
