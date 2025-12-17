// routes/payment.routes.js
const express = require('express');
const router = express.Router();

// On importe le controller qu'on vient de créer
const paymentController = require('../controllers/payment.controller');

// On importe le middleware pour protéger la route (seuls les connectés peuvent payer)
// Vérifie que le nom de ton fichier est bien 'auth.middleware.js' dans le dossier middleware
const authMiddleware = require('../middleware/auth.middleware');

// La route sera: POST /api/payment/verify-paypal
router.post('/verify-paypal', authMiddleware, paymentController.validatePayPalPayment);

module.exports = router;