const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const reservationController = require('../controllers/reservation.controller');

router.use(authMiddleware);

// ✅ CRÉER UNE RÉSERVATION
router.post('/', reservationController.create);

// ✅ MES RÉSERVATIONS (PASSAGER)
router.get('/my-reservations', reservationController.myReservations);

// ✅ RÉSERVATIONS D'UN TRAJET (CONDUCTEUR) - Route principale
router.get('/for-ride/:rideId', reservationController.getRideReservations);
router.get('/ride/:rideId', reservationController.getRideReservations); // Alias

// ✅ CONFIRMER UNE RÉSERVATION (pending → confirmed)
router.put('/:id/confirm', reservationController.confirm);

// ✅ TERMINER UNE RÉSERVATION (confirmed → completed)
router.put('/:id/complete', reservationController.completeReservation);
router.patch('/:id/complete', reservationController.completeReservation); // Alias

// ✅ REFUSER UNE RÉSERVATION
router.put('/:id/reject', reservationController.reject);

// ✅ ANNULER UNE RÉSERVATION (PASSAGER)
router.put('/:id/cancel', reservationController.cancel);

// ✅ DEMANDES EN ATTENTE (CONDUCTEUR)
router.get('/driver/requests', reservationController.getDriverRequests);

// ✅ DÉTAILS D'UNE RÉSERVATION
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

  const db = require('../config/db');
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