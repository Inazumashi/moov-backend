// routes/reservation.routes.js - VERSION COMPLÈTE
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../config/db');

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);

// Obtenir toutes les réservations de l'utilisateur
router.get('/my-reservations', (req, res) => {
  const userId = req.userId;

  const sql = `
    SELECT 
      b.id,
      b.ride_id,
      b.passenger_id,
      b.seats_booked as seats,
      b.total_price,
      b.status,
      b.booking_date as created_at,
      r.departure_date,
      r.departure_time,
      r.arrival_date,
      r.arrival_time,
      r.driver_id,
      ds.name as departure_station,
      ars.name as arrival_station,
      u.first_name as driver_first_name,
      u.last_name as driver_last_name,
      u.rating as driver_rating,
      u.phone as driver_phone
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    JOIN users u ON r.driver_id = u.id
    WHERE b.passenger_id = ?
    ORDER BY b.booking_date DESC
  `;

  db.all(sql, [userId], (err, reservations) => {
    if (err) {
      console.error('Erreur récupération réservations:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    // Formater les données
    const formattedReservations = (reservations || []).map(r => ({
      id: r.id,
      ride_id: r.ride_id,
      passenger_id: r.passenger_id,
      seats: r.seats,
      total_price: r.total_price,
      status: r.status,
      created_at: r.created_at,
      departure_date: r.departure_date,
      departure_time: r.departure_time,
      arrival_date: r.arrival_date,
      arrival_time: r.arrival_time,
      departure_station: r.departure_station,
      arrival_station: r.arrival_station,
      driver_id: r.driver_id,
      driver_first_name: r.driver_first_name,
      driver_last_name: r.driver_last_name,
      driver_name: `${r.driver_first_name} ${r.driver_last_name}`,
      driver_rating: r.driver_rating,
      driver_phone: r.driver_phone
    }));

    res.json({
      success: true,
      reservations: formattedReservations,
      count: formattedReservations.length
    });
  });
});

// Créer une réservation
router.post('/', (req, res) => {
  const userId = req.userId;
  const { ride_id, seats, pickup_point, dropoff_point } = req.body;

  // Validation
  if (!ride_id || !seats) {
    return res.status(400).json({
      success: false,
      message: 'ride_id et seats sont requis'
    });
  }

  // Vérifier que le trajet existe et a assez de places
  const rideSql = `
    SELECT r.*, 
           (SELECT COALESCE(SUM(b.seats_booked as seats), 0) FROM bookings b 
            WHERE b.ride_id = r.id AND b.status IN ('confirmed', 'pending')) as booked_seats
    FROM rides r
    WHERE r.id = ? AND r.status = 'active'
  `;

  db.get(rideSql, [ride_id], (err, ride) => {
    if (err || !ride) {
      return res.status(404).json({
        success: false,
        message: 'Trajet non trouvé ou non disponible'
      });
    }

    // Vérifier les places disponibles
    const availableSeats = ride.available_seats - ride.booked_seats;
    if (availableSeats < seats) {
      return res.status(400).json({
        success: false,
        message: `Pas assez de places disponibles (${availableSeats} restantes)`
      });
    }

    // Vérifier que l'utilisateur n'est pas le conducteur
    if (ride.driver_id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas réserver votre propre trajet'
      });
    }

    // Calculer le prix total
    const totalPrice = ride.price_per_seat * seats;

    // Créer la réservation
    const insertSql = `
      INSERT INTO bookings (
        ride_id, passenger_id, seats, total_price, 
        pickup_point, dropoff_point, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `;

    db.run(
      insertSql,
      [ride_id, userId, seats, totalPrice, pickup_point, dropoff_point],
      function(err) {
        if (err) {
          console.error('Erreur création réservation:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la création'
          });
        }

        res.status(201).json({
          success: true,
          message: 'Réservation créée avec succès',
          reservation: {
            id: this.lastID,
            ride_id,
            seats,
            total_price: totalPrice,
            status: 'pending'
          }
        });
      }
    );
  });
});

// Annuler une réservation
router.put('/:id/cancel', (req, res) => {
  const userId = req.userId;
  const reservationId = req.params.id;

  // Vérifier que la réservation appartient à l'utilisateur
  const checkSql = `
    SELECT id, status, ride_id 
    FROM bookings 
    WHERE id = ? AND passenger_id = ?
  `;

  db.get(checkSql, [reservationId, userId], (err, booking) => {
    if (err || !booking) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cette réservation est déjà annulée'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'annuler une réservation terminée'
      });
    }

    // Annuler la réservation
    const updateSql = `
      UPDATE bookings 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;

    db.run(updateSql, [reservationId], (err) => {
      if (err) {
        console.error('Erreur annulation:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'annulation'
        });
      }

      res.json({
        success: true,
        message: 'Réservation annulée avec succès'
      });
    });
  });
});

// Marquer une réservation comme terminée (pour le conducteur)
router.patch('/:id/complete', (req, res) => {
  const userId = req.userId;
  const reservationId = req.params.id;

  // Vérifier que l'utilisateur est le conducteur du trajet
  const checkSql = `
    SELECT b.id, b.status, r.driver_id
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    WHERE b.id = ? AND r.driver_id = ?
  `;

  db.get(checkSql, [reservationId, userId], (err, booking) => {
    if (err || !booking) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier cette réservation'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cette réservation est déjà terminée'
      });
    }

    // Marquer comme complétée
    const updateSql = `
      UPDATE bookings 
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;

    db.run(updateSql, [reservationId], (err) => {
      if (err) {
        console.error('Erreur complétion:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la mise à jour'
        });
      }

      res.json({
        success: true,
        message: 'Réservation marquée comme terminée'
      });
    });
  });
});

// Obtenir les détails d'une réservation
router.get('/:id', (req, res) => {
  const userId = req.userId;
  const reservationId = req.params.id;

  const sql = `
    SELECT 
      b.*,
      r.departure_date,
      r.departure_time,
      r.arrival_date,
      r.arrival_time,
      r.driver_id,
      ds.name as departure_station,
      ars.name as arrival_station,
      u.first_name as driver_first_name,
      u.last_name as driver_last_name,
      u.rating as driver_rating
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    JOIN users u ON r.driver_id = u.id
    WHERE b.id = ? AND b.passenger_id = ?
  `;

  db.get(sql, [reservationId, userId], (err, reservation) => {
    if (err) {
      console.error('Erreur récupération réservation:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    res.json({
      success: true,
      reservation
    });
  });
});

module.exports = router;