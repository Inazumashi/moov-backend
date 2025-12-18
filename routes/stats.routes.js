// routes/stats.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../config/db');

router.use(authMiddleware);

// Dashboard des statistiques
router.get('/dashboard', (req, res) => {
  const userId = req.userId;

  // 1. Vérifier statut Premium
  db.get('SELECT premium_status FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    // Si pas premium, bloquer l'accès (ou retourner une version limitée)
    if (user.premium_status !== 'premium') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux membres Premium.',
        is_premium_required: true
      });
    }

    // 2. Requête pour toutes les stats (Code existant)
    const sql = `
    SELECT 
      -- Info utilisateur
      u.created_at as member_since,
      u.total_trips,
      u.rating as average_rating,
      u.is_driver,
      
      -- Trajets ce mois (Conducteur + Passager)
      ((SELECT COUNT(*) FROM bookings b 
        WHERE b.passenger_id = ? 
        AND strftime('%Y-%m', b.booking_date) = strftime('%Y-%m', 'now')
        AND b.status = 'completed') 
       +
       (SELECT COUNT(*) FROM rides r
        WHERE r.driver_id = ?
        AND strftime('%Y-%m', r.departure_date) = strftime('%Y-%m', 'now')
        AND r.status = 'completed')
      ) as trips_this_month,
      
      -- Distance totale (50km par trajet terminé, conducteur ou passager)
      ((SELECT COUNT(*) FROM bookings b WHERE b.passenger_id = ? AND b.status = 'completed') * 50
       +
       (SELECT COUNT(*) FROM rides r WHERE r.driver_id = ? AND r.status = 'completed') * 50
      ) as total_distance,
      
      -- CO2 économisé (0.2kg/km * passagers)
      -- En tant que passager : j'économise 1 voiture (ma part) -> 50 * 0.2 * 1
      -- En tant que conducteur : j'économise N voitures (mes passagers) -> 50 * 0.2 * seats_booked
      (
        (SELECT COUNT(*) FROM bookings b WHERE b.passenger_id = ? AND b.status = 'completed') * 50 * 0.2
        +
        (SELECT COALESCE(SUM(
           (SELECT COUNT(*) FROM bookings b WHERE b.ride_id = r.id AND b.status = 'completed') * 50 * 0.2
         ), 0)
         FROM rides r 
         WHERE r.driver_id = ? AND r.status = 'completed')
      ) as co2_saved,
       
      -- Argent économisé / Gagné (Prix des places vendues)
      (SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b
       JOIN rides r ON b.ride_id = r.id
       WHERE r.driver_id = ?
       AND b.status = 'completed') as money_saved,
       
      -- Stats conducteur (Passagers transportés)
      (SELECT COUNT(DISTINCT b.passenger_id) FROM bookings b
       JOIN rides r ON b.ride_id = r.id
       WHERE r.driver_id = ?
       AND b.status = 'completed') as total_passengers,
       
      -- Satisfaction
      (SELECT COUNT(*) * 100.0 / NULLIF(COUNT(*), 0) 
       FROM bookings b
       JOIN rides r ON b.ride_id = r.id
       WHERE r.driver_id = ?
       AND b.status IN ('completed', 'confirmed')) as satisfied_passengers
       
    FROM users u
    WHERE u.id = ?
  `;

    // Params order: 
    // 1. passenger trips month
    // 2. driver trips month
    // 3. passenger distance
    // 4. driver distance
    // 5. passenger co2
    // 6. driver co2
    // 7. driver revenue
    // 8. driver total passengers
    // 9. satisfied passengers
    // 10. main user id
    const params = Array(10).fill(userId);

    db.get(sql, params, (err, stats) => {
      if (err) {
        console.error('Erreur stats dashboard:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
      }

      if (!stats) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      res.json({
        success: true,
        stats: {
          memberSince: stats.member_since ? new Date(stats.member_since).getFullYear() : new Date().getFullYear(),
          totalTrips: stats.total_trips || 0,
          averageRating: parseFloat((stats.average_rating || 5.0).toFixed(1)),
          tripsThisMonth: stats.trips_this_month || 0,
          totalDistance: Math.round(stats.total_distance || 0),
          co2Saved: Math.round(stats.co2_saved || 0), // Now using new formula
          moneySaved: Math.round(stats.money_saved || 0), // Added money saved
          totalPassengers: stats.total_passengers || 0,
          satisfiedPassengers: Math.round(stats.satisfied_passengers || 100)
        }
      });
    });
  });
});

// Stats mensuelles
router.get('/monthly', (req, res) => {
  const userId = req.userId;
  const year = req.query.year || new Date().getFullYear();

  const sql = `
    SELECT 
      strftime('%m', b.booking_date as created_at) as month,
      COUNT(*) as count,
      SUM(b.total_price) as revenue
    FROM bookings b
    WHERE b.passenger_id = ?
    AND strftime('%Y', b.booking_date as created_at) = ?
    AND b.status = 'completed'
    GROUP BY month
    ORDER BY month
  `;

  db.all(sql, [userId, year.toString()], (err, data) => {
    if (err) {
      console.error('Erreur stats mensuelles:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    // Remplir les mois manquants avec 0
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: (i + 1).toString().padLeft(2, '0'),
      count: 0,
      revenue: 0
    }));

    data.forEach(row => {
      const index = parseInt(row.month) - 1;
      months[index] = {
        month: row.month,
        count: row.count,
        revenue: row.revenue
      };
    });

    res.json({ success: true, data: months });
  });
});

// Top trajets
router.get('/top-routes', (req, res) => {
  const userId = req.userId;

  const sql = `
    SELECT 
      ds.name as departure_station,
      ars.name as arrival_station,
      COUNT(*) as count,
      AVG(b.total_price) as avg_price
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    WHERE b.passenger_id = ?
    AND b.status = 'completed'
    GROUP BY r.departure_station_id, r.arrival_station_id
    ORDER BY count DESC
    LIMIT 5
  `;

  db.all(sql, [userId], (err, routes) => {
    if (err) {
      console.error('Erreur top routes:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    res.json({ success: true, top_routes: routes || [] });
  });
});

// Activité récente
router.get('/recent-activity', (req, res) => {
  const userId = req.userId;
  const limit = req.query.limit || 10;

  const sql = `
    SELECT 
      'ride' as type,
      ds.name || ' → ' || ars.name as title,
      b.booking_date as created_at as timestamp
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    WHERE b.passenger_id = ?
    ORDER BY b.booking_date DESC
    LIMIT ?
  `;

  db.all(sql, [userId, parseInt(limit)], (err, activities) => {
    if (err) {
      console.error('Erreur activité récente:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    res.json({ success: true, activities: activities || [] });
  });
});

module.exports = router;