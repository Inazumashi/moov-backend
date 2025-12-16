// routes/ride.routes.js - VERSION COMPLÈTE CORRIGÉE
const express = require('express');
const router = express.Router();
const rideController = require('../controllers/ride.controller');
const authMiddleware = require('../middleware/auth.middleware');

// --- 1. Routes Publiques Spécifiques (D'abord) ---
router.get('/search', rideController.search);
router.get('/quick-search', rideController.quickSearch);

// --- 2. Routes Protégées Spécifiques (AVANT /:id) ---
router.get('/my-rides', authMiddleware, rideController.myRides);

// --- 3. Routes Publiques Dynamiques (Après les spécifiques) ---
router.get('/:id', rideController.getDetails);

// --- 4. Autres Routes Protégées ---
// Appliquer authMiddleware pour toutes les routes suivantes
router.use(authMiddleware);

// ✅ CRÉATION DE TRAJET
router.post('/', rideController.create);

// ✅ MISE À JOUR DE TRAJET
router.put('/:id', rideController.update);

// ✅ SUPPRESSION DE TRAJET (ANNULATION)
router.delete('/:id', rideController.cancel);

// ✅ SUPPRESSION DÉFINITIVE (SI AUCUNE RÉSERVATION ACTIVE)
router.delete('/:id/remove', rideController.remove);

// ✅ MARQUER TRAJET COMME COMPLÉTÉ
router.patch('/:id/complete', rideController.complete);

module.exports = router;