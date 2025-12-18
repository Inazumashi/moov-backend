const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const db = require('../config/db');
const util = require('util');

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

      // Notifier le conducteur
      try {
        await Notification.create({
          user_id: ride.driver_id,
          title: 'Nouvelle réservation !',
          message: `Un passager a réservé ${seatsBooked} place(s) pour votre trajet`,
          type: 'info',
          related_entity_type: 'booking',
          related_entity_id: result.id
        }, () => {});
      } catch (e) {
        console.warn('Erreur notification:', e);
      }

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

  // ✅ NOUVEAU: Récupérer TOUTES les réservations pour UN trajet (conducteur)
  getRideReservations: async (req, res) => {
    const driverId = req.userId;
    const { rideId } = req.params;

    try {
      console.log(`📋 Récupération réservations pour trajet #${rideId} par conducteur #${driverId}`);

      // Vérifier que le trajet appartient au conducteur
      const rideSql = `SELECT id FROM rides WHERE id = ? AND driver_id = ?`;
      const ride = await getAsync(rideSql, [rideId, driverId]);

      if (!ride) {
        return res.status(403).json({ 
          success: false, 
          message: 'Trajet non trouvé ou non autorisé' 
        });
      }

      // Récupérer toutes les réservations avec détails passagers
      const sql = `
        SELECT 
          b.id,
          b.ride_id,
          b.passenger_id,
          b.seats_booked as seats,
          b.total_price,
          b.status,
          b.booking_date as created_at,
          b.completed_at,
          u.first_name,
          u.last_name,
          u.phone,
          u.email,
          u.rating as passenger_rating,
          (SELECT COUNT(*) FROM ratings WHERE booking_id = b.id) as has_rating
        FROM bookings b
        JOIN users u ON b.passenger_id = u.id
        WHERE b.ride_id = ?
        ORDER BY 
          CASE b.status 
            WHEN 'pending' THEN 1
            WHEN 'confirmed' THEN 2
            WHEN 'completed' THEN 3
            WHEN 'cancelled' THEN 4
          END,
          b.booking_date DESC
      `;

      const reservations = await allAsync(sql, [rideId]);

      // Formater pour le frontend
      const formattedReservations = reservations.map(r => ({
        id: r.id,
        ride_id: r.ride_id,
        passenger_id: r.passenger_id,
        passenger_name: `${r.first_name} ${r.last_name}`,
        passenger_photo: null, // Peut être ajouté si vous avez des photos
        seats_reserved: r.seats,
        total_price: r.total_price,
        status: r.status,
        created_at: r.created_at,
        completed_at: r.completed_at,
        passenger_phone: r.phone,
        passenger_email: r.email,
        passenger_rating: r.passenger_rating,
        has_been_rated: r.has_rating > 0
      }));

      console.log(`✅ ${formattedReservations.length} réservation(s) trouvée(s)`);

      res.json({ 
        success: true, 
        reservations: formattedReservations,
        count: formattedReservations.length
      });

    } catch (error) {
      console.error('❌ Erreur getRideReservations:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Alias pour compatibilité
  rideReservations: async (req, res) => {
    return reservationController.getRideReservations(req, res);
  },

  // ✅ AMÉLIORER: Confirmer une réservation (passe de pending à confirmed)
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

      await runAsync(`UPDATE bookings SET status = 'confirmed' WHERE id = ?`, [id]);

      try {
        await Notification.create({
          user_id: booking.passenger_id,
          title: 'Réservation confirmée !',
          message: 'Le conducteur a confirmé votre réservation. Bon voyage !',
          type: 'success',
          related_entity_type: 'booking',
          related_entity_id: id
        }, () => {});
      } catch (e) {
        console.warn('Erreur notification:', e);
      }

      res.json({ success: true, message: 'Réservation confirmée' });
    } catch (error) {
      console.error('Erreur confirm:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // ✅ AMÉLIORER: Terminer une réservation (passe à completed)
  completeReservation: async (req, res) => {
    const driverId = req.userId;
    const { id } = req.params;

    try {
      console.log(`✅ Tentative de complétion réservation #${id} par conducteur #${driverId}`);

      const checkSql = `
        SELECT b.id, b.passenger_id, b.status, r.driver_id 
        FROM bookings b
        JOIN rides r ON b.ride_id = r.id
        WHERE b.id = ?
      `;

      const booking = await getAsync(checkSql, [id]);

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
      }

      if (booking.driver_id !== driverId) {
        return res.status(403).json({ success: false, message: 'Non autorisé' });
      }

      if (booking.status === 'completed') {
        return res.status(400).json({ success: false, message: 'Réservation déjà terminée' });
      }

      if (booking.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'Impossible de terminer une réservation annulée' });
      }

      await runAsync(
        "UPDATE bookings SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?", 
        [id]
      );

      // Notifier le passager
      try {
        await Notification.create({
          user_id: booking.passenger_id,
          title: 'Trajet terminé',
          message: 'Le conducteur a marqué le trajet comme terminé. N\'oubliez pas de laisser une note !',
          type: 'info',
          related_entity_type: 'booking',
          related_entity_id: id
        }, () => {});
      } catch (e) {
        console.warn('Erreur notification:', e);
      }

      console.log(`✅ Réservation #${id} marquée comme terminée`);

      res.json({ 
        success: true, 
        message: 'Réservation terminée avec succès' 
      });

    } catch (error) {
      console.error('❌ Erreur completeReservation:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Alias pour compatibilité
  complete: async (req, res) => {
    return reservationController.completeReservation(req, res);
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

      try {
        await Notification.create({
          user_id: booking.passenger_id,
          title: 'Réservation refusée',
          message: 'Le conducteur a refusé votre demande.',
          type: 'warning',
          related_entity_type: 'booking',
          related_entity_id: id
        }, () => {});
      } catch (e) {
        console.warn('Erreur notification:', e);
      }

      res.json({ success: true, message: 'Réservation refusée' });
    } catch (error) {
      console.error('Erreur reject:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Récupérer les demandes en attente pour le conducteur
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
  }
};

module.exports = reservationController;