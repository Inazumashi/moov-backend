// routes/search.routes.js - NOUVEAU FICHIER
const express = require('express');
const router = express.Router();
const rideController = require('../controllers/ride.controller');
const stationController = require('../controllers/station.controller');

// Routes de recherche publiques
router.get('/rides', rideController.search);
router.get('/rides/quick', rideController.quickSearch);
router.get('/stations', stationController.autocomplete);
router.get('/stations/nearby', stationController.nearby);
router.get('/stations/popular', stationController.popular);

module.exports = router;