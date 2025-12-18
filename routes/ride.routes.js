const express = require('express');
const router = express.Router();
const rideController = require('../controllers/ride.controller');
const preferenceController = require('../controllers/preference.controller');
const authMiddleware = require('../middleware/auth.middleware');

// ============================================================
// ⚠️ IMPORTANT: Les routes spécifiques DOIVENT être avant /:id
// Sinon Express interprète "my-rides" comme un ID !
// ============================================================

// ============================================================
// 1. ROUTES SPÉCIFIQUES (avant /:id)
// ============================================================

// Recherche - publique
router.get('/search', rideController.search);
router.get('/quick-search', rideController.quickSearch);

// ✅ CORRECTION: my-rides AVANT /:id
router.get('/my-rides', authMiddleware, rideController.myRides);
router.get('/suggestions', authMiddleware, preferenceController.getSuggestions);

// ============================================================
// 2. ROUTES AVEC PARAMÈTRES (après les routes spécifiques)
// ============================================================

// Détails d'un trajet - public
router.get('/:id', rideController.getDetails);

// Actions de modification (Auth requise)
router.post('/', authMiddleware, rideController.create);
router.post('/preferences', authMiddleware, preferenceController.setFrequentRoute);
router.delete('/:id', authMiddleware, rideController.remove);
router.put('/:id/complete', authMiddleware, rideController.complete);

module.exports = router;