const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/forgot-password
router.post('/forgot-password', authController.forgotPassword);

// --- AJOUTEZ CES DEUX ROUTES ---
// POST /api/auth/send-email-verification
router.post('/send-email-verification', authController.sendEmailVerification);

// POST /api/auth/verify-email-code
router.post('/verify-email-code', authController.verifyEmailCode);

module.exports = router;