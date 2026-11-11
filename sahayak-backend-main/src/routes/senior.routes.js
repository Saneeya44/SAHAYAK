const express = require('express');
const { authenticate, requireRoles } = require('../middlewares/auth');
const { list, getOne, updateMine } = require('../controllers/senior.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRoles([ROLES.POLICE_ADMIN, ROLES.WARD_AGENT]), list);
router.patch('/me', requireRoles([ROLES.SENIOR]), updateMine);
router.get('/:id', getOne);

module.exports = router;
