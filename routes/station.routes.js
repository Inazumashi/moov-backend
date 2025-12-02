// routes/station.routes.js
const express = require('express');
const router = express.Router();
const stationController = require('../controllers/station.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Routes publiques
router.get('/autocomplete', stationController.autocomplete);
router.get('/nearby', stationController.nearby);
router.get('/popular', stationController.popular);
router.get('/university/:universityId', stationController.byUniversity);
router.get('/city/:city', stationController.byCity);
router.get('/popular-routes', stationController.popularRoutes);

// Routes protégées
router.use(authMiddleware);
router.post('/favorites', stationController.addToFavorites);
router.delete('/favorites', stationController.removeFromFavorites);
router.get('/favorites', stationController.myFavorites);
router.get('/recent', stationController.recent);

module.exports = router;