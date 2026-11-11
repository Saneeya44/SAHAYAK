const express = require('express');
const { authenticate, requireRoles } = require('../middlewares/auth');
const { context, report, getOne, list, update } = require('../controllers/incident.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate);

router.get('/:id/context', requireRoles([ROLES.POLICE_ADMIN]), context);
router.post('/', report);
router.get('/', list);
router.get('/:trackingId', getOne);
router.patch('/:trackingId', requireRoles([ROLES.POLICE_ADMIN, ROLES.WARD_AGENT]), update);

module.exports = router;
