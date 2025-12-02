const Reservation = require('../models/reservation.model');
const Ride = require('../models/ride.model');

const reservationController = {
  // Réserver un trajet
  create: async (req, res) => {
    try {
      const passengerId = req.userId;
      const { rideId, seatsBooked = 1 } = req.body;

      if (!rideId) {
        return res.status(400).json({
          success: false,
          message: 'ID du trajet requis'
        });
      }

      // Vérifier que l'utilisateur ne réserve pas son propre trajet
      const rideSql = `SELECT driver_id FROM rides WHERE id = ?`;
      db.get(rideSql, [rideId], (err, ride) => {
        if (err || !ride) {
          return res.status(404).json({
            success: false,
            message: 'Trajet non trouvé'
          });
        }

        if (ride.driver_id === passengerId) {
          return res.status(400).json({
            success: false,
            message: 'Vous ne pouvez pas réserver votre propre trajet'
          });
        }

        // Vérifier si déjà réservé
        Reservation.hasBooked(rideId, passengerId, (err, hasBooked) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Erreur serveur'
            });
          }

          if (hasBooked) {
            return res.status(400).json({
              success: false,
              message: 'Vous avez déjà réservé ce trajet'
            });
          }

          // Créer la réservation
          Reservation.create({ rideId, passengerId, seatsBooked }, (err, result) => {
            if (err) {
              return res.status(400).json({
                success: false,
                message: err.message || 'Erreur lors de la réservation'
              });
            }

            res.status(201).json({
              success: true,
              message: 'Réservation effectuée avec succès',
              reservation: {
                id: result.id,
                totalPrice: result.totalPrice,
                seatsBooked: result.seatsBooked
              }
            });
          });
        });
      });
    } catch (error) {
      console.error('Erreur réservation:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Annuler une réservation
  cancel: async (req, res) => {
    try {
      const passengerId = req.userId;
      const { id } = req.params;
      const { reason } = req.body;

      Reservation.cancel(id, passengerId, reason, (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            message: err.message || 'Erreur lors de l\'annulation'
          });
        }

        res.json({
          success: true,
          message: 'Réservation annulée avec succès'
        });
      });
    } catch (error) {
      console.error('Erreur annulation:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Mes réservations (passager)
  myReservations: async (req, res) => {
    try {
      const passengerId = req.userId;
      const { status } = req.query;

      Reservation.findByPassenger(passengerId, status, (err, reservations) => {
        if (err) {
          console.error('Erreur récupération réservations:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        // Grouper par statut
        const grouped = {
          upcoming: reservations.filter(r => 
            r.status === 'confirmed' && 
            new Date(r.departure_date) > new Date()
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
    try {
      const driverId = req.userId;
      const { rideId } = req.params;

      // Vérifier que le conducteur possède ce trajet
      const checkSql = `SELECT id FROM rides WHERE id = ? AND driver_id = ?`;
      db.get(checkSql, [rideId, driverId], (err, ride) => {
        if (err || !ride) {
          return res.status(403).json({
            success: false,
            message: 'Vous n\'êtes pas le conducteur de ce trajet'
          });
        }

        Reservation.findByRide(rideId, (err, reservations) => {
          if (err) {
            console.error('Erreur récupération réservations:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur serveur'
            });
          }

          res.json({
            success: true,
            reservations,
            count: reservations.length
          });
        });
      });
    } catch (error) {
      console.error('Erreur réservations trajet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
};

module.exports = reservationController;