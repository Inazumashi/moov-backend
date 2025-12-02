// routes/ride.routes.js - VERSION SIMPLIFIÉE POUR TEST
const express = require('express');
const router = express.Router();
const rideController = require('../controllers/ride.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Routes publiques (recherche sans authentification)
router.get('/search', rideController.search);
router.get('/quick-search', rideController.quickSearch);
router.get('/:id', rideController.getDetails);

// Routes protégées
router.use(authMiddleware);
router.post('/', rideController.create);
router.get('/my-rides', rideController.myRides);
// Les routes update, cancel, complete seront ajoutées plus tard
// router.put('/:id', rideController.update);
// router.delete('/:id', rideController.cancel);
// router.patch('/:id/complete', rideController.complete);

module.exports = router;