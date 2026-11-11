const express = require('express');
const authRoutes = require('./auth.routes');
const volunteerRoutes = require('./volunteer.routes');
const seniorRoutes = require('./senior.routes');
const requestRoutes = require('./request.routes');
const emergencyRoutes = require('./emergency.routes');
const incidentRoutes = require('./incident.routes');
const patrolRoutes = require('./patrol.routes');
const dashboardRoutes = require('./dashboard.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/volunteers', volunteerRoutes);
router.use('/seniors', seniorRoutes);
router.use('/requests', requestRoutes);
router.use('/incidents', incidentRoutes);
router.use('/patrols', patrolRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/', emergencyRoutes);

module.exports = router;
