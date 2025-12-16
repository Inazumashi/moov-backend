const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../config/db');

router.use(authMiddleware);

// ✅ Noter un conducteur après un trajet
router.post('/', (req, res) => {
  const passengerId = req.userId;
  const { bookingId, rideId, driverId, rating, comment } = req.body;

  // Validation
  if (!bookingId || !rideId || !driverId || !rating) {
    return res.status(400).json({
      success: false,
      message: 'Tous les champs sont requis'
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: 'La note doit être entre 1 et 5'
    });
  }

  // Vérifier que la réservation appartient au passager
  const checkSql = `
    SELECT b.id, b.status, r.driver_id 
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    WHERE b.id = ? AND b.passenger_id = ?
  `;

  db.get(checkSql, [bookingId, passengerId], (err, booking) => {
    if (err) {
      console.error('Erreur vérification réservation:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    if (!booking) {
      return res.status(403).json({
        success: false,
        message: 'Réservation non trouvée ou non autorisée'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez noter qu\'après la fin du trajet'
      });
    }

    // Vérifier si déjà noté
    const checkRatingSql = `SELECT id FROM ratings WHERE booking_id = ?`;

    db.get(checkRatingSql, [bookingId], (err, existingRating) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur'
        });
      }

      if (existingRating) {
        return res.status(400).json({
          success: false,
          message: 'Vous avez déjà noté ce trajet'
        });
      }

      // Insérer la note
      const insertSql = `
        INSERT INTO ratings (booking_id, ride_id, passenger_id, driver_id, rating, comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(insertSql, [bookingId, rideId, passengerId, driverId, rating, comment], function(err) {
        if (err) {
          console.error('Erreur insertion note:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la note'
          });
        }

        // Mettre à jour la moyenne du conducteur
        updateDriverRating(driverId);

        res.status(201).json({
          success: true,
          message: 'Note enregistrée avec succès',
          rating_id: this.lastID
        });
      });
    });
  });
});

// ✅ Obtenir les notes d'un conducteur
router.get('/driver/:driverId', (req, res) => {
  const { driverId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const sql = `
    SELECT 
      r.*,
      u.first_name as passenger_name,
      u.last_name as passenger_last_name
    FROM ratings r
    JOIN users u ON r.passenger_id = u.id
    WHERE r.driver_id = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.all(sql, [driverId, parseInt(limit), offset], (err, ratings) => {
    if (err) {
      console.error('Erreur récupération notes:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    // Compter le total
    const countSql = `SELECT COUNT(*) as total FROM ratings WHERE driver_id = ?`;

    db.get(countSql, [driverId], (err, count) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur'
        });
      }

      // Calculer la moyenne
      const avgSql = `SELECT AVG(rating) as avg_rating FROM ratings WHERE driver_id = ?`;

      db.get(avgSql, [driverId], (err, avg) => {
        res.json({
          success: true,
          ratings: ratings,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count.total,
            total_pages: Math.ceil(count.total / limit)
          },
          average_rating: avg.avg_rating || 0,
          total_ratings: count.total
        });
      });
    });
  });
});

// ✅ Vérifier si un trajet peut être noté
router.get('/can-rate/:bookingId', (req, res) => {
  const passengerId = req.userId;
  const { bookingId } = req.params;

  const sql = `
    SELECT 
      b.id,
      b.status,
      r.driver_id,
      (SELECT COUNT(*) FROM ratings WHERE booking_id = b.id) as already_rated
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    WHERE b.id = ? AND b.passenger_id = ?
  `;

  db.get(sql, [bookingId, passengerId], (err, booking) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    res.json({
      success: true,
      can_rate: booking.status === 'completed' && booking.already_rated === 0,
      reason: booking.status !== 'completed' 
        ? 'Trajet non terminé' 
        : booking.already_rated > 0 
          ? 'Déjà noté' 
          : null
    });
  });
});

// ✅ Mes notes données (en tant que passager)
router.get('/my-ratings', (req, res) => {
  const passengerId = req.userId;

  const sql = `
    SELECT 
      r.*,
      u.first_name as driver_name,
      u.last_name as driver_last_name,
      rd.departure_station_id,
      rd.arrival_station_id,
      ds.name as departure_station,
      das.name as arrival_station
    FROM ratings r
    JOIN users u ON r.driver_id = u.id
    JOIN rides rd ON r.ride_id = rd.id
    JOIN stations ds ON rd.departure_station_id = ds.id
    JOIN stations das ON rd.arrival_station_id = das.id
    WHERE r.passenger_id = ?
    ORDER BY r.created_at DESC
  `;

  db.all(sql, [passengerId], (err, ratings) => {
    if (err) {
      console.error('Erreur récupération mes notes:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    res.json({
      success: true,
      ratings: ratings,
      total: ratings.length
    });
  });
});

// Fonction helper pour mettre à jour la moyenne du conducteur
function updateDriverRating(driverId) {
  const sql = `
    UPDATE users 
    SET rating = (
      SELECT AVG(rating) FROM ratings WHERE driver_id = ?
    ),
    total_trips = (
      SELECT COUNT(DISTINCT ride_id) FROM ratings WHERE driver_id = ?
    )
    WHERE id = ?
  `;

  db.run(sql, [driverId, driverId, driverId], (err) => {
    if (err) {
      console.error('Erreur mise à jour rating conducteur:', err);
    }
  });
}

module.exports = router;