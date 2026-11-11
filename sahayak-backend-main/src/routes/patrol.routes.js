const express = require('express');
const { authenticate, requireRoles } = require('../middlewares/auth');
const { checkin, list } = require('../controllers/patrol.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate);
router.post('/checkin', requireRoles([ROLES.POLICE_ADMIN, ROLES.WARD_AGENT]), checkin);
router.get('/', requireRoles([ROLES.POLICE_ADMIN, ROLES.WARD_AGENT]), list);

module.exports = router;
