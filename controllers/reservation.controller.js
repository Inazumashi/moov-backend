const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const db = require('../config/db');
const util = require('util');

// Promisification
db.get = util.promisify(db.get);
db.run = util.promisify(db.run);

const reservationController = {
  // Réserver un trajet
  create: async (req, res) => {
    const passengerId = req.userId;
    const { rideId, seatsBooked = 1 } = req.body;

    console.log('📝 Réservation - Données reçues:', { passengerId, rideId, seatsBooked });

    if (!rideId) {
      return res.status(400).json({ success: false, message: 'ID du trajet requis' });
    }

    try {
      // ✅ CORRECTION : Accepter les trajets avec status 'pending' OU 'active'
      const rideSql = `SELECT driver_id, available_seats, price_per_seat, status 
                       FROM rides 
                       WHERE id = ? 
                       AND status IN ('active', 'pending')`;
      
      console.log('🔍 Recherche trajet avec ID:', rideId);
      const ride = await db.get(rideSql, [rideId]);

      console.log('📊 Trajet trouvé:', ride);

      if (!ride) {
        return res.status(404).json({ 
          success: false, 
          message: 'Trajet non trouvé ou non disponible' 
        });
      }

      if (ride.driver_id === passengerId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vous ne pouvez pas réserver votre propre trajet' 
        });
      }

      // Vérifier si déjà réservé
      const hasBooked = await Reservation.hasBooked(rideId, passengerId);
      if (hasBooked) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vous avez déjà réservé ce trajet' 
        });
      }

      // Créer la réservation
      const result = await Reservation.create({ rideId, passengerId, seatsBooked });

      res.status(201).json({
        success: true,
        message: 'Réservation effectuée avec succès',
        reservation: result
      });

    } catch (error) {
      console.error('❌ Erreur réservation:', error.message || error);
      const statusCode = error.message.includes('places') || error.message.includes('Trajet') ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erreur serveur'
      });
    }
  },

  // Annuler une réservation
  cancel: async (req, res) => {
    const passengerId = req.userId;
    const { id } = req.params;
    const { reason } = req.body;

    try {
      await Reservation.cancel(id, passengerId, reason);

      res.json({
        success: true,
        message: 'Réservation annulée avec succès'
      });
    } catch (error) {
      console.error('Erreur annulation:', error);
      const statusCode = error.message.includes('Réservation') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erreur lors de l\'annulation'
      });
    }
  },

  // Mes réservations (passager)
  myReservations: async (req, res) => {
    const passengerId = req.userId;
    const { status } = req.query;

    try {
      const reservations = await Reservation.findByPassenger(passengerId, status);

      // Grouper par statut
      const grouped = {
        upcoming: reservations.filter(r =>
          r.status === 'confirmed' &&
          new Date(r.departure_date + ' ' + r.departure_time) > new Date()
        ),
        pending: reservations.filter(r => r.status === 'pending'),
        completed: reservations.filter(r => r.status === 'completed'),
        cancelled: reservations.filter(r => r.status === 'cancelled')
      };

      res.json({
        success: true,
        reservations,
        grouped,
        count: reservations.length
      });
    } catch (error) {
      console.error('Erreur mes réservations:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Réservations de mon trajet (conducteur)
  rideReservations: async (req, res) => {
    const driverId = req.userId;
    const { rideId } = req.params;

    try {
      const checkSql = `SELECT id FROM rides WHERE id = ? AND driver_id = ?`;
      const ride = await db.get(checkSql, [rideId, driverId]);

      if (!ride) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas le conducteur de ce trajet'
        });
      }

      const reservations = await Reservation.findByRide(rideId);

      res.json({
        success: true,
        reservations,
        count: reservations.length
      });
    } catch (error) {
      console.error('Erreur réservations trajet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Marquer comme complété
  complete: async (req, res) => {
    const userId = req.userId;
    const { id } = req.params;

    try {
      const sql = `SELECT b.*, r.driver_id 
                   FROM bookings b 
                   JOIN rides r ON b.ride_id = r.id 
                   WHERE b.id = ?`;
      const booking = await db.get(sql, [id]);

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
      }

      const user = await new Promise((resolve, reject) => {
        User.findById(userId, (err, u) => {
          if (err) return reject(err);
          resolve(u);
        });
      });

      const isAdmin = user && user.profile_type === 'admin';
      const isDriver = booking.driver_id === userId;

      if (!isDriver && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      if (booking.status === 'completed') {
        return res.status(409).json({ success: false, message: 'Réservation déjà complétée' });
      }

      if (booking.status === 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          message: 'Impossible de marquer une réservation annulée comme complétée' 
        });
      }

      const updateSql = `UPDATE bookings 
                         SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
                         WHERE id = ?`;
      await db.run(updateSql, [id]);

      if (booking.driver_id) {
        db.run(`UPDATE users 
                SET total_trips_as_driver = COALESCE(total_trips_as_driver,0) + 1 
                WHERE id = ?`, 
          [booking.driver_id]
        ).catch(err => console.error('Erreur incrément:', err));
      }

      const updated = await db.get(`SELECT * FROM bookings WHERE id = ?`, [id]);

      res.json({ success: true, reservation: updated });
    } catch (error) {
      console.error('Erreur complete:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
};

module.exports = reservationController;