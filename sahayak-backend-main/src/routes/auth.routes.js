const express = require('express');
const { register, login, refresh, logout, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');
const { rateLimit } = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/register', rateLimit({ windowMs: 60_000, max: 15, keyPrefix: 'reg' }), register);
router.post('/login', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'login' }), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);

module.exports = router;
