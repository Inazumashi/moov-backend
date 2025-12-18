const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const Notification = require('../models/notification.model'); // Import Notification
const db = require('../config/db');
const util = require('util');

// Promisification LOCAL (Ne pas écraser db.get globalement !)
const getAsync = util.promisify(db.get).bind(db);
const runAsync = util.promisify(db.run).bind(db);
const allAsync = util.promisify(db.all).bind(db);

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
      const rideSql = `SELECT driver_id, available_seats, price_per_seat, status 
                       FROM rides 
                       WHERE id = ? 
                       AND status IN ('active', 'pending')`;

      const ride = await getAsync(rideSql, [rideId]);

      if (!ride) {
        return res.status(404).json({ success: false, message: 'Trajet non trouvé ou non disponible' });
      }

      if (ride.driver_id === passengerId) {
        return res.status(400).json({ success: false, message: 'Vous ne pouvez pas réserver votre propre trajet' });
      }

      const hasBooked = await Reservation.hasBooked(rideId, passengerId);
      if (hasBooked) {
        return res.status(400).json({ success: false, message: 'Vous avez déjà réservé ce trajet' });
      }

      const result = await Reservation.create({ rideId, passengerId, seatsBooked });

      res.status(201).json({
        success: true,
        message: 'Réservation effectuée avec succès',
        reservation: result
      });

    } catch (error) {
      console.error('❌ Erreur réservation:', error.message || error);
      const statusCode = error.message.includes('places') || error.message.includes('Trajet') ? 400 : 500;
      res.status(statusCode).json({ success: false, message: error.message || 'Erreur serveur' });
    }
  },

  // Annuler une réservation
  cancel: async (req, res) => {
    const passengerId = req.userId;
    const { id } = req.params;
    const { reason } = req.body;

    try {
      await Reservation.cancel(id, passengerId, reason);
      res.json({ success: true, message: 'Réservation annulée avec succès' });
    } catch (error) {
      console.error('Erreur annulation:', error);
      const statusCode = error.message.includes('Réservation') ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message || 'Erreur lors de l\'annulation' });
    }
  },

  // Mes réservations (passager)
  myReservations: async (req, res) => {
    const passengerId = req.userId;
    const { status } = req.query;

    try {
      const reservations = await Reservation.findByPassenger(passengerId, status);
      const grouped = {
        upcoming: reservations.filter(r => r.status === 'confirmed' && new Date(r.departure_date + ' ' + r.departure_time) > new Date()),
        pending: reservations.filter(r => r.status === 'pending'),
        completed: reservations.filter(r => r.status === 'completed'),
        cancelled: reservations.filter(r => r.status === 'cancelled')
      };

      res.json({ success: true, reservations, grouped, count: reservations.length });
    } catch (error) {
      console.error('Erreur mes réservations:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Réservations de mon trajet (conducteur)
  rideReservations: async (req, res) => {
    // Alias vers getRideReservations pour maintenir compatibilité
    return reservationController.getRideReservations(req, res);
  },

  // Marquer comme complété (Legacy / Alias vers completeReservation)
  complete: async (req, res) => {
    return reservationController.completeReservation(req, res);
  },

  // Récupérer les demandes pour le conducteur (Pending)
  getDriverRequests: async (req, res) => {
    const driverId = req.userId;
    try {
      const sql = `SELECT b.*, r.departure_station_id, r.arrival_station_id, r.departure_date, r.departure_time,
                          u.first_name as passenger_first_name, u.last_name as passenger_last_name, u.phone as passenger_phone
                   FROM bookings b
                   JOIN rides r ON b.ride_id = r.id
                   JOIN users u ON b.passenger_id = u.id
                   WHERE r.driver_id = ? AND b.status = 'pending'
                   ORDER BY b.created_at DESC`;
      const requests = await allAsync(sql, [driverId]);
      res.json({ success: true, requests });
    } catch (error) {
      console.error('Erreur driver requests:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Accepter une réservation
  confirm: async (req, res) => {
    const driverId = req.userId;
    const { id } = req.params;

    try {
      const sql = `SELECT b.*, r.driver_id, r.available_seats, r.id as ride_id
                   FROM bookings b
                   JOIN rides r ON b.ride_id = r.id
                   WHERE b.id = ?`;
      const booking = await getAsync(sql, [id]);

      if (!booking) return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
      if (booking.driver_id !== driverId) return res.status(403).json({ success: false, message: 'Non autorisé' });
      if (booking.status !== 'pending') return res.status(400).json({ success: false, message: 'La réservation n\'est pas en attente' });
      if (booking.available_seats < booking.seats_booked) return res.status(400).json({ success: false, message: 'Plus assez de places disponibles' });

      await runAsync(`UPDATE bookings SET status = 'confirmed' WHERE id = ?`, [id]);
      await runAsync(`UPDATE rides SET available_seats = available_seats - ? WHERE id = ?`, [booking.seats_booked, booking.ride_id]);

      try {
        const notif = new Notification({
          user_id: booking.passenger_id,
          title: 'Réservation acceptée !',
          message: `Votre demande pour le trajet est validée. Bon voyage !`,
          type: 'success',
          related_entity_type: 'booking',
          related_entity_id: id
        });
        // Note: Notification.create works with callbacks or constructor? 
        // Based on model review, likely Notification.create is static convenience. 
        // Using static create if available or direct DB insert. 
        // Assuming model has static create from previous edits:
        Notification.create({
          user_id: booking.passenger_id,
          title: 'Réservation acceptée !',
          message: 'Votre réservation a été validée.',
          type: 'success',
          related_entity_type: 'booking',
          related_entity_id: id
        }, () => { });
      } catch (e) { console.warn('Notif error', e); }

      res.json({ success: true, message: 'Réservation confirmée' });
    } catch (error) {
      console.error('Erreur confirm:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Refuser une réservation
  reject: async (req, res) => {
    const driverId = req.userId;
    const { id } = req.params;

    try {
      const sql = `SELECT b.*, r.driver_id FROM bookings b JOIN rides r ON b.ride_id = r.id WHERE b.id = ?`;
      const booking = await getAsync(sql, [id]);

      if (!booking) return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
      if (booking.driver_id !== driverId) return res.status(403).json({ success: false, message: 'Non autorisé' });

      await runAsync(`UPDATE bookings SET status = 'cancelled', cancellation_reason = 'Refusé par conducteur' WHERE id = ?`, [id]);

      Notification.create({
        user_id: booking.passenger_id,
        title: 'Réservation refusée',
        message: `Le conducteur a refusé votre demande.`,
        type: 'warning',
        related_entity_type: 'booking',
        related_entity_id: id
      }, () => { });

      res.json({ success: true, message: 'Réservation refusée' });
    } catch (error) {
      console.error('Erreur reject:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Récupérer toutes les réservations d'un trajet (Pour le conducteur)
  getRideReservations: async (req, res) => {
    const userId = req.userId;
    const { rideId } = req.params;

    try {
      const sql = `
        SELECT 
          b.id, b.status, b.seats_booked, b.passenger_id,
          u.first_name, u.last_name, u.phone
        FROM bookings b
        JOIN users u ON b.passenger_id = u.id
        JOIN rides r ON b.ride_id = r.id
        WHERE b.ride_id = ? AND r.driver_id = ?
      `;

      const bookings = await allAsync(sql, [rideId, userId]);
      res.json({ success: true, bookings: bookings || [] });
    } catch (error) {
      console.error('Erreur getRideReservations:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Terminer une réservation spécifique
  completeReservation: async (req, res) => {
    const userId = req.userId;
    const { id } = req.params;

    try {
      const checkSql = `
        SELECT b.id, b.passenger_id, r.driver_id 
        FROM bookings b
        JOIN rides r ON b.ride_id = r.id
        WHERE b.id = ?
      `;

      const booking = await getAsync(checkSql, [id]);

      if (!booking) return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
      if (booking.driver_id !== userId) return res.status(403).json({ success: false, message: 'Non autorisé' });

      await runAsync("UPDATE bookings SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

      // Notifier le passager
      Notification.create({
        user_id: booking.passenger_id,
        title: 'Trajet terminé',
        message: 'Le conducteur a marqué le trajet comme terminé.',
        type: 'info',
        related_entity_type: 'booking',
        related_entity_id: id
      }, () => { });

      res.json({ success: true, message: 'Réservation terminée' });

    } catch (error) {
      console.error('Erreur completeReservation:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
};

module.exports = reservationController;