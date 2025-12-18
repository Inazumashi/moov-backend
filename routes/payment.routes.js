// routes/payment.routes.js
const express = require('express');
const router = express.Router();

// On importe le controller qu'on vient de créer
const paymentController = require('../controllers/payment.controller');

// On importe le middleware pour protéger la route (seuls les connectés peuvent payer)
// Vérifie que le nom de ton fichier est bien 'auth.middleware.js' dans le dossier middleware
const authMiddleware = require('../middleware/auth.middleware');

// La route sera: POST /api/payment/verify-paypal
router.post('/verify-paypal', authMiddleware, paymentController.validatePayPalPayment); // Deprecated but kept
router.post('/create-order', authMiddleware, paymentController.createOrder);
router.post('/capture-order', authMiddleware, paymentController.captureOrder);
router.post('/process', paymentController.processPremiumPayment); // Simple mock
router.post('/premium', paymentController.processPremiumPayment); // Simple mock

module.exports = router;