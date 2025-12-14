const express = require('express');
const router = express.Router();
const rideController = require('../controllers/ride.controller');
const authMiddleware = require('../middleware/auth.middleware');

// --- 1. Routes Publiques Spécifiques (D'abord) ---
router.get('/search', rideController.search);
router.get('/quick-search', rideController.quickSearch);

// --- 2. Routes Protégées Spécifiques (AVANT /:id) ---
// On applique authMiddleware directement ici pour pouvoir la placer avant /:id
router.get('/my-rides', authMiddleware, rideController.myRides);

// --- 3. Routes Publiques Dynamiques (Après les spécifiques) ---
// Celle-ci attrape tout ce qui ressemble à un ID.
// Si on la met avant 'my-rides', elle intercepte la requête.
router.get('/:id', rideController.getDetails);

// --- 4. Autres Routes Protégées ---
// Pour le reste des routes en dessous, on applique le middleware globalement
router.use(authMiddleware);

router.post('/', rideController.create);

// Routes futures
// router.put('/:id', rideController.update);
// router.delete('/:id', rideController.cancel);
// router.patch('/:id/complete', rideController.complete);

module.exports = router;