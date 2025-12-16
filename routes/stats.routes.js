const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../config/db');

router.use(authMiddleware);

// ✅ Statistiques globales utilisateur
router.get('/dashboard', (req, res) => {
  const userId = req.userId;
  
  const sql = `
    SELECT 
      u.first_name,
      u.last_name,
      u.email,
      u.is_driver,
      u.has_car,
      u.rating,
      u.total_trips,
      u.created_at as member_since,
      (SELECT COUNT(*) FROM rides WHERE driver_id = ?) as rides_published,
      (SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'completed') as rides_completed,
      (SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'active') as rides_active,
      (SELECT AVG(price_per_seat) FROM rides WHERE driver_id = ?) as avg_price_driver,
      (SELECT SUM(b.total_price) 
       FROM bookings b 
       JOIN rides r ON b.ride_id = r.id 
       WHERE r.driver_id = ? AND b.status = 'completed') as total_earned,
      (SELECT COUNT(*) FROM bookings WHERE passenger_id = ?) as bookings_total,
      (SELECT COUNT(*) FROM bookings WHERE passenger_id = ? AND status = 'confirmed') as bookings_confirmed,
      (SELECT COUNT(*) FROM bookings WHERE passenger_id = ? AND status = 'completed') as bookings_completed,
      (SELECT SUM(total_price) FROM bookings WHERE passenger_id = ? AND status = 'completed') as total_spent,
      (SELECT COUNT(*) FROM favorite_rides WHERE user_id = ?) as favorites_count,
      (SELECT COUNT(*) FROM ratings WHERE driver_id = ?) as ratings_received,
      (SELECT AVG(rating) FROM ratings WHERE driver_id = ?) as avg_rating_received,
      (SELECT COUNT(*) FROM ratings WHERE passenger_id = ?) as ratings_given
    FROM users u
    WHERE u.id = ?
  `;
  
  db.get(sql, [
    userId, userId, userId, userId, userId,
    userId, userId, userId, userId,
    userId,
    userId, userId, userId,
    userId
  ], (err, stats) => {
    if (err) {
      console.error('Erreur stats dashboard:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
    if (!stats) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const avgPublicTransportCost = 80;
    const economiesPotentielles = (stats.bookings_completed || 0) * 
                                  (avgPublicTransportCost - (stats.total_spent || 0) / Math.max(stats.bookings_completed || 1, 1));
    const co2Saved = (stats.bookings_completed || 0) * 15;

    res.json({
      success: true,
      stats: {
        ...stats,
        economies_estimees: Math.max(economiesPotentielles, 0),
        co2_saved_kg: co2Saved,
        member_for_days: Math.floor((Date.now() - new Date(stats.member_since).getTime()) / (1000 * 60 * 60 * 24))
      }
    });
  });
});

// Monthly graphs
router.get('/monthly', (req, res) => {
  const userId = req.userId;
  const { year = new Date().getFullYear() } = req.query;
  const sql = `
    SELECT 
      strftime('%m', created_at) as month,
      COUNT(*) as count,
      'ride' as type
    FROM rides
    WHERE driver_id = ? 
    AND strftime('%Y', created_at) = ?
    GROUP BY month
    UNION ALL
    SELECT 
      strftime('%m', created_at) as month,
      COUNT(*) as count,
      'booking' as type
    FROM bookings
    WHERE passenger_id = ?
    AND strftime('%Y', created_at) = ?
    GROUP BY month
    ORDER BY month
  `;
  db.all(sql, [userId, year.toString(), userId, year.toString()], (err, data) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({ month: (i + 1).toString().padStart(2, '0'), rides: 0, bookings: 0 }));
    data.forEach(row => {
      const monthIndex = parseInt(row.month) - 1;
      if (row.type === 'ride') monthlyData[monthIndex].rides = row.count;
      else monthlyData[monthIndex].bookings = row.count;
    });
    res.json({ success: true, year: parseInt(year), data: monthlyData });
  });
});

// Top routes
router.get('/top-routes', (req, res) => {
  const userId = req.userId;
  const sql = `
    SELECT 
      ds.name as departure,
      ars.name as arrival,
      COUNT(*) as count,
      AVG(r.price_per_seat) as avg_price
    FROM rides r
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    WHERE r.driver_id = ?
    GROUP BY r.departure_station_id, r.arrival_station_id
    ORDER BY count DESC
    LIMIT 5
  `;
  db.all(sql, [userId], (err, routes) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    res.json({ success: true, top_routes: routes });
  });
});

// Recent activity
router.get('/recent-activity', (req, res) => {
  const userId = req.userId;
  const { limit = 10 } = req.query;
  const sql = `
    SELECT 
      'ride' as type,
      r.id,
      ds.name as departure,
      ars.name as arrival,
      r.departure_date as date,
      r.status,
      r.price_per_seat as amount
    FROM rides r
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    WHERE r.driver_id = ?
    UNION ALL
    SELECT 
      'booking' as type,
      b.id,
      ds.name as departure,
      ars.name as arrival,
      r.departure_date as date,
      b.status,
      b.total_price as amount
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    WHERE b.passenger_id = ?
    ORDER BY date DESC
    LIMIT ?
  `;
  db.all(sql, [userId, userId, parseInt(limit)], (err, activities) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    res.json({ success: true, activities: activities });
  });
});

module.exports = router;
