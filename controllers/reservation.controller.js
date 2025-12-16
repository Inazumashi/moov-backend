const Reservation = require('../models/reservation.model');
const Ride = require('../models/ride.model');
const User = require('../models/user.model');
const db = require('../config/db');

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
,

  // Marquer une réservation comme complétée (conducteur ou admin)
  complete: async (req, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params; // booking id

      // Récupérer la réservation + driver
      const sql = `SELECT b.*, r.driver_id FROM bookings b JOIN rides r ON b.ride_id = r.id WHERE b.id = ?`;
      db.get(sql, [id], (err, booking) => {
        if (err) {
          console.error('Erreur récupération réservation:', err);
          return res.status(500).json({ success: false, message: 'Erreur serveur' });
        }

        if (!booking) {
          return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
        }

        // Récupérer l'utilisateur (pour vérifier rôle admin)
        User.findById(userId, (err, user) => {
          if (err) {
            console.error('Erreur récupération utilisateur:', err);
            return res.status(500).json({ success: false, message: 'Erreur serveur' });
          }

          const isAdmin = user && user.profile_type === 'admin';
          const isDriver = booking.driver_id === userId;

          if (!isDriver && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
          }

          if (booking.status === 'completed') {
            return res.status(409).json({ success: false, message: 'Réservation déjà complétée' });
          }

          if (booking.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Impossible de marquer une réservation annulée comme complétée' });
          }

          // Vérifier si la colonne completed_at existe, sinon l'ajouter
          db.all("PRAGMA table_info(bookings)", [], (err, cols) => {
            if (err) {
              console.error('Erreur PRAGMA:', err);
              return res.status(500).json({ success: false, message: 'Erreur serveur' });
            }

            const hasCompletedAt = cols && cols.some(c => c.name === 'completed_at');

            const proceedUpdate = () => {
              const updateSql = `UPDATE bookings SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`;
              db.run(updateSql, [id], function(err) {
                if (err) {
                  console.error('Erreur mise à jour réservation:', err);
                  return res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
                }

                // Optionnel: incrémenter compteur conducteur
                if (booking.driver_id) {
                  db.run(`UPDATE users SET total_trips_as_driver = COALESCE(total_trips_as_driver,0) + 1 WHERE id = ?`, [booking.driver_id], (err) => {
                    if (err) console.error('Erreur incrément total_trips_as_driver:', err);
                  });
                }

                // Retourner la réservation mise à jour
                const selectSql = `SELECT b.* FROM bookings b WHERE b.id = ?`;
                db.get(selectSql, [id], (err, updated) => {
                  if (err) {
                    console.error('Erreur récupération réservation mise à jour:', err);
                    return res.status(500).json({ success: false, message: 'Erreur serveur' });
                  }

                  res.json({ success: true, reservation: updated });
                });
              });
            };

            if (!hasCompletedAt) {
              db.run(`ALTER TABLE bookings ADD COLUMN completed_at DATETIME`, [], (err) => {
                if (err) {
                  console.error('Erreur ajout colonne completed_at:', err);
                  // Ne bloquons pas l'opération si l'ALTER échoue — tenter quand même la mise à jour
                }
                proceedUpdate();
              });
            } else {
              proceedUpdate();
            }
          });
        });
      });
    } catch (error) {
      console.error('Erreur complete reservation:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
};

module.exports = reservationController;