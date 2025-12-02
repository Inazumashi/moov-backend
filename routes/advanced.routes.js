const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const FavoriteRide = require('../models/favoriteRide.model');
const Ride = require('../models/ride.model');

router.use(authMiddleware);

// Trajets récurrents
router.get('/recurring-rides', (req, res) => {
  const driverId = req.userId;
  
  Ride.getRecurringRides(driverId, (err, rides) => {
    if (err) {
      console.error('Erreur trajets récurrents:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
    
    res.json({
      success: true,
      recurring_rides: rides
    });
  });
});

// Favoris de trajets
router.post('/favorite-rides', (req, res) => {
  const userId = req.userId;
  const { rideId } = req.body;
  
  if (!rideId) {
    return res.status(400).json({
      success: false,
      message: 'ID du trajet requis'
    });
  }
  
  FavoriteRide.add(userId, rideId, (err) => {
    if (err) {
      console.error('Erreur ajout favori:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
    
    res.json({
      success: true,
      message: 'Trajet ajouté aux favoris'
    });
  });
});

router.delete('/favorite-rides/:rideId', (req, res) => {
  const userId = req.userId;
  const { rideId } = req.params;
  
  FavoriteRide.remove(userId, rideId, (err) => {
    if (err) {
      console.error('Erreur suppression favori:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
    
    res.json({
      success: true,
      message: 'Trajet retiré des favoris'
    });
  });
});

router.get('/favorite-rides', (req, res) => {
  const userId = req.userId;
  
  FavoriteRide.getByUser(userId, (err, favorites) => {
    if (err) {
      console.error('Erreur récupération favoris:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
    
    res.json({
      success: true,
      favorite_rides: favorites
    });
  });
});

// Statistiques avancées
router.get('/statistics', (req, res) => {
  const userId = req.userId;
  
  const statsSql = `
    SELECT 
      -- En tant que conducteur
      (SELECT COUNT(*) FROM rides WHERE driver_id = ?) as total_drives,
      (SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'completed') as completed_drives,
      (SELECT AVG(price_per_seat) FROM rides WHERE driver_id = ?) as avg_price_driver,
      
      -- En tant que passager
      (SELECT COUNT(*) FROM bookings WHERE passenger_id = ?) as total_bookings,
      (SELECT COUNT(*) FROM bookings WHERE passenger_id = ? AND status = 'completed') as completed_bookings,
      (SELECT AVG(total_price) FROM bookings WHERE passenger_id = ?) as avg_spent,
      
      -- Trajets récurrents
      (SELECT COUNT(*) FROM rides WHERE driver_id = ? AND recurrence != 'none') as recurring_rides_count,
      
      -- Économies estimées (comparé au train/CTM)
      (SELECT SUM(total_price) FROM bookings WHERE passenger_id = ?) as total_spent,
      (SELECT COUNT(*) FROM bookings WHERE passenger_id = ?) * 50 as estimated_savings  -- 50 MAD par trajet économisé
    FROM users WHERE id = ?`;
  
  db.get(statsSql, [
    userId, userId, userId,  // driver stats
    userId, userId, userId,  // passenger stats
    userId,                  // recurring
    userId, userId,          // savings
    userId
  ], (err, stats) => {
    if (err) {
      console.error('Erreur statistiques:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
    
    // Calculer l'empreinte carbone économisée
    // Hypothèse: 0.2kg CO2/km économisé par passager
    const estimatedCO2Saved = (stats.completed_bookings || 0) * 50 * 0.2; // 50km moyen
    
    res.json({
      success: true,
      statistics: {
        ...stats,
        co2_saved_kg: Math.round(estimatedCO2Saved * 100) / 100,
        estimated_savings: stats.estimated_savings || 0
      }
    });
  });
});

// Alertes de disponibilité (quand un trajet favori a des places)
router.get('/availability-alerts', (req, res) => {
  const userId = req.userId;
  
  const sql = `
    SELECT r.*, 
           ds.name as departure_station,
           as.name as arrival_station,
           fr.created_at as favorited_at
    FROM favorite_rides fr
    JOIN rides r ON fr.ride_id = r.id
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations as ON r.arrival_station_id = as.id
    WHERE fr.user_id = ?
    AND r.status = 'active'
    AND r.available_seats > 0
    AND DATE(r.departure_date) >= DATE('now')
    ORDER BY r.departure_date`;
  
  db.all(sql, [userId], (err, alerts) => {
    if (err) {
      console.error('Erreur alertes:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
    
    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
  });
});

module.exports = router;