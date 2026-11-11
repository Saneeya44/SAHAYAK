const express = require('express');
const { authenticate, requireRoles } = require('../middlewares/auth');
const { requireUuidParam } = require('../middlewares/validate');
const {
  create,
  list,
  getOne,
  accept,
  start,
  complete,
  cancel,
  escalate,
  sos,
} = require('../controllers/request.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate);

router.post('/', requireRoles([ROLES.SENIOR, ROLES.POLICE_ADMIN, ROLES.WARD_AGENT]), create);
router.post('/sos', requireRoles([ROLES.SENIOR, ROLES.POLICE_ADMIN]), sos);
router.get('/', list);
router.get('/:id', requireUuidParam('id'), getOne);
router.patch('/:id/accept', requireRoles([ROLES.VOLUNTEER]), requireUuidParam('id'), accept);
router.patch('/:id/start', requireRoles([ROLES.VOLUNTEER, ROLES.POLICE_ADMIN]), requireUuidParam('id'), start);
router.patch('/:id/complete', requireRoles([ROLES.VOLUNTEER, ROLES.POLICE_ADMIN]), requireUuidParam('id'), complete);
router.patch('/:id/cancel', requireUuidParam('id'), cancel);
router.post('/:id/escalate', requireUuidParam('id'), escalate);

module.exports = router;
