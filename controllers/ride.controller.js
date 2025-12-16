// controllers/ride.controller.js - VERSION CORRIGÉE FINALE
const db = require('../config/db');
const Ride = require('../models/ride.model');
const Station = require('../models/station.model');
const Route = require('../models/route.model');

const rideController = {
  // CRÉER UN TRAJET AVEC AUTO-COMPLÉTION ET AUTO-CONDUCTEUR
  create: async (req, res) => {
    try {
      const driverId = req.userId;
      const {
        departure_station_id,
        arrival_station_id,
        departure_date,
        departure_time,
        arrival_date,
        arrival_time,
        available_seats,
        price_per_seat,
        recurrence,
        recurrence_days,
        recurrence_end_date,
        notes
      } = req.body;

      // Validation
      const requiredFields = [
        'departure_station_id', 'arrival_station_id', 
        'departure_date', 'departure_time'
      ];
      
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({
            success: false,
            message: `Le champ "${field}" est requis`
          });
        }
      }

      // Vérifier que les stations existent
      Station.findById(departure_station_id, (err, departureStation) => {
        if (err || !departureStation) {
          return res.status(404).json({
            success: false,
            message: 'Station de départ non trouvée'
          });
        }

        Station.findById(arrival_station_id, (err, arrivalStation) => {
          if (err || !arrivalStation) {
            return res.status(404).json({
              success: false,
              message: 'Station d\'arrivée non trouvée'
            });
          }

          // Vérifier que ce n'est pas la même station
          if (departure_station_id === arrival_station_id) {
            return res.status(400).json({
              success: false,
              message: 'Les stations de départ et d\'arrivée doivent être différentes'
            });
          }

          // ⭐⭐ MODIFICATION IMPORTANTE : AUTO-MARQUER COMME CONDUCTEUR ⭐⭐
          const userSql = 'SELECT is_driver FROM users WHERE id = ?';
          db.get(userSql, [driverId], async (err, user) => {
            if (err || !user) {
              return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
              });
            }

            // Si l'utilisateur n'est pas encore conducteur, le devenir automatiquement
            if (!user.is_driver) {
              console.log(`🚗 Utilisateur ${driverId} devient conducteur automatiquement`);
              
              db.run('UPDATE users SET is_driver = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                [driverId], 
                (updateErr) => {
                  if (updateErr) {
                    console.error('Erreur mise à jour conducteur:', updateErr);
                    // On continue quand même avec la création du trajet
                  } else {
                    console.log(`✅ Utilisateur ${driverId} marqué comme conducteur`);
                    
                    // Mettre aussi has_car = 1 par défaut
                    db.run('UPDATE users SET has_car = 1 WHERE id = ?', [driverId], (carErr) => {
                      if (carErr) console.error('Erreur mise à jour voiture:', carErr);
                    });
                  }
                  
                  // Continuer avec la création du trajet
                  _createRideAfterDriverCheck();
                }
              );
            } else {
              // Déjà conducteur, continuer directement
              _createRideAfterDriverCheck();
            }

            // Fonction pour créer le trajet après vérification du statut conducteur
            function _createRideAfterDriverCheck() {
              // Créer le trajet
              const rideData = {
                driver_id: driverId,
                departure_station_id,
                arrival_station_id,
                departure_date,
                departure_time,
                arrival_date,
                arrival_time,
                available_seats: available_seats || 4,
                price_per_seat: price_per_seat || 20.0,
                recurrence: recurrence || 'none',
                recurrence_days: recurrence_days || null,
                recurrence_end_date: recurrence_end_date || null,
                notes: notes || null
              };

              Ride.create(rideData, (err, newRide) => {
                if (err) {
                  console.error('Erreur création trajet:', err);
                  return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la création du trajet'
                  });
                }

                // Mettre à jour l'itinéraire populaire
                Route.updatePopularRoute(departure_station_id, arrival_station_id, () => {});

                // Obtenir les détails complets du trajet créé
                Ride.findById(newRide.id, (err, rideDetails) => {
                  if (err) {
                    console.error('Erreur récupération détails:', err);
                    // On retourne quand même le succès
                  }

                  res.status(201).json({
                    success: true,
                    message: recurrence === 'none' ? 
                      'Trajet créé avec succès' : 
                      'Trajet récurrent créé avec succès',
                    ride: rideDetails || { id: newRide.id },
                    user_became_driver: !user.is_driver // Indique si l'utilisateur vient de devenir conducteur
                  });
                });
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Erreur création trajet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // RECHERCHE AVANCÉE - ✅ CORRECTION ICI
  search: async (req, res) => {
    try {
      const searchParams = req.query;

      // Log pour déboguer
      console.log('🔍 Paramètres de recherche reçus :', searchParams);

      // Valider les paramètres
      if (!searchParams.departure_station_id && !searchParams.arrival_station_id) {
        return res.status(400).json({
          success: false,
          message: 'Au moins une station (départ ou arrivée) est requise'
        });
      }

      Ride.searchAdvanced(searchParams, (err, result) => {
        if (err) {
          console.error('Erreur recherche trajets:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche'
          });
        }

        // Log pour déboguer
        console.log('📊 Résultats trouvés :', result.rides.length);
        if (result.rides.length > 0) {
          console.log('📋 Premier trajet :', result.rides[0]);
        }

        // Si on a des résultats, mettre à jour l'itinéraire populaire
        if (result.rides.length > 0 && searchParams.departure_station_id && searchParams.arrival_station_id) {
          Route.updatePopularRoute(
            searchParams.departure_station_id,
            searchParams.arrival_station_id,
            () => {}
          );
        }

        res.json({
          success: true,
          ...result,
          query: searchParams
        });
      });
    } catch (error) {
      console.error('Erreur recherche trajets:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // RECHERCHE RAPIDE (par nom de stations)
  quickSearch: async (req, res) => {
    try {
      const { departure, arrival, date } = req.query;

      if (!departure || !arrival) {
        return res.status(400).json({
          success: false,
          message: 'Les stations de départ et d\'arrivée sont requises'
        });
      }

      // D'abord, trouver les stations qui correspondent
      Station.search(departure, 5, req.userId, (err, departureStations) => {
        if (err || departureStations.length === 0) {
          return res.json({
            success: true,
            message: 'Aucune station de départ trouvée',
            rides: [],
            suggested_departures: []
          });
        }

        Station.search(arrival, 5, req.userId, (err, arrivalStations) => {
          if (err || arrivalStations.length === 0) {
            return res.json({
              success: true,
              message: 'Aucune station d\'arrivée trouvée',
              rides: [],
              suggested_arrivals: []
            });
          }

          // Chercher les trajets pour chaque combinaison possible
          const allRides = [];
          const searchPromises = [];

          departureStations.forEach(depStation => {
            arrivalStations.forEach(arrStation => {
              if (depStation.id !== arrStation.id) {
                searchPromises.push(
                  new Promise((resolve) => {
                    Ride.searchByStations(
                      depStation.name,
                      arrStation.name,
                      date,
                      (err, rides) => {
                        if (!err && rides) {
                          allRides.push(...rides);
                        }
                        resolve();
                      }
                    );
                  })
                );
              }
            });
          });

          Promise.all(searchPromises).then(() => {
            // Éliminer les doublons
            const uniqueRides = Array.from(
              new Map(allRides.map(ride => [ride.id, ride])).values()
            );

            // Trier par date
            uniqueRides.sort((a, b) => new Date(a.departure_date) - new Date(b.departure_date));

            res.json({
              success: true,
              rides: uniqueRides,
              suggested_departures: departureStations,
              suggested_arrivals: arrivalStations,
              count: uniqueRides.length
            });
          });
        });
      });
    } catch (error) {
      console.error('Erreur recherche rapide:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Suggestions intelligentes
  suggestions: async (req, res) => {
    try {
      const userId = req.userId;
      Ride.getSuggestions(userId, (err, rides) => {
        if (err) {
          console.error('Erreur suggestions:', err);
          return res.status(500).json({ success: false, message: 'Erreur serveur' });
        }

        res.json({ success: true, suggestions: rides });
      });
    } catch (error) {
      console.error('Erreur suggestions controller:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // DÉTAILS D'UN TRAJET
  getDetails: async (req, res) => {
    try {
      const { id } = req.params;

      Ride.findById(id, (err, ride) => {
        if (err) {
          console.error('Erreur récupération trajet:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        if (!ride) {
          return res.status(404).json({
            success: false,
            message: 'Trajet non trouvé'
          });
        }

        // Trouver des trajets similaires
        Ride.findSimilar(
          ride.departure_station_id,
          ride.arrival_station_id,
          ride.id,
          3,
          (err, similarRides) => {
            res.json({
              success: true,
              ride,
              similar_rides: similarRides || [],
              available_seats: ride.available_seats - (ride.booked_seats || 0)
            });
          }
        );
      });
    } catch (error) {
      console.error('Erreur détails trajet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // TRAJETS DU CONDUCTEUR - ✅ CORRECTION ALIAS "ars"
  myRides: async (req, res) => {
    try {
      const driverId = req.userId;
      const { status, page = 1, limit = 20 } = req.query;

      // CORRECTION : Utilisation correcte de l'alias "ars" au lieu de "as"
            let sql = `SELECT r.*, 
            ds.name as departure_station,
            ars.name as arrival_station, 
            (SELECT COUNT(*) FROM bookings b 
             WHERE b.ride_id = r.id AND b.status IN ('confirmed', 'completed')) as booked_seats,
            (SELECT COUNT(*) FROM bookings b2 
             WHERE b2.ride_id = r.id AND b2.status IN ('pending', 'confirmed')) as active_bookings
           FROM rides r
           JOIN stations ds ON r.departure_station_id = ds.id
           JOIN stations ars ON r.arrival_station_id = ars.id
           WHERE r.driver_id = ?`;
      
      const params = [driverId];
      
      if (status) {
        sql += ` AND r.status = ?`;
        params.push(status);
      }
      
      sql += ` ORDER BY r.departure_date DESC 
               LIMIT ? OFFSET ?`;
      
      const offset = (page - 1) * limit;
      params.push(parseInt(limit), offset);
      
      db.all(sql, params, (err, rides) => {
        if (err) {
          console.error('Erreur récupération trajets:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        // Ajouter flag can_delete = true si pas de réservations actives
        const mapped = (rides || []).map(r => ({
          ...r,
          can_delete: !(r.active_bookings && r.active_bookings > 0)
        }));

        res.json({
          success: true,
          rides: mapped,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            count: mapped.length
          }
        });
      });
    } catch (error) {
      console.error('Erreur trajets conducteur:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Mettre à jour un trajet
  update: async (req, res) => {
    try {
      const driverId = req.userId;
      const rideId = req.params.id;
      const updateData = req.body;

      // Vérifier que le trajet appartient au conducteur
      const checkSql = `SELECT id FROM rides WHERE id = ? AND driver_id = ?`;
      db.get(checkSql, [rideId, driverId], (err, ride) => {
        if (err || !ride) {
          return res.status(403).json({
            success: false,
            message: 'Vous n\'êtes pas autorisé à modifier ce trajet'
          });
        }

        // Construire la requête de mise à jour dynamique
        const updates = [];
        const values = [];

        if (updateData.departure_time !== undefined) {
          updates.push('departure_time = ?');
          values.push(updateData.departure_time);
        }

        if (updateData.available_seats !== undefined) {
          updates.push('available_seats = ?');
          values.push(updateData.available_seats);
        }

        if (updateData.price_per_seat !== undefined) {
          updates.push('price_per_seat = ?');
          values.push(updateData.price_per_seat);
        }

        if (updateData.notes !== undefined) {
          updates.push('notes = ?');
          values.push(updateData.notes);
        }

        if (updateData.status !== undefined) {
          updates.push('status = ?');
          values.push(updateData.status);
        }

        if (updates.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Aucune donnée à mettre à jour'
          });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(rideId);

        const sql = `UPDATE rides SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(sql, values, (err) => {
          if (err) {
            console.error('Erreur mise à jour trajet:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la mise à jour'
            });
          }

          res.json({
            success: true,
            message: 'Trajet mis à jour avec succès'
          });
        });
      });
    } catch (error) {
      console.error('Erreur update trajet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Annuler un trajet
  cancel: async (req, res) => {
    try {
      const userId = req.userId;
      const rideId = req.params.id;

      // Vérifier que l'utilisateur est le conducteur
      const checkSql = `SELECT id, status FROM rides WHERE id = ? AND driver_id = ?`;
      db.get(checkSql, [rideId, userId], (err, ride) => {
        if (err || !ride) {
          return res.status(403).json({
            success: false,
            message: 'Trajet non trouvé ou vous n\'êtes pas le conducteur'
          });
        }

        if (ride.status === 'cancelled') {
          return res.status(400).json({
            success: false,
            message: 'Ce trajet est déjà annulé'
          });
        }

        // Vérifier s'il y a des réservations actives
        const bookingsSql = `SELECT COUNT(*) as count FROM bookings WHERE ride_id = ? AND status IN ('pending', 'confirmed')`;
        db.get(bookingsSql, [rideId], (err, result) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Erreur serveur'
            });
          }

          if (result.count > 0) {
            return res.status(400).json({
              success: false,
              message: 'Impossible d\'annuler un trajet avec des réservations actives'
            });
          }

          // Annuler le trajet
          const updateSql = `UPDATE rides SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
          db.run(updateSql, [rideId], (err) => {
            if (err) {
              console.error('Erreur annulation trajet:', err);
              return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'annulation'
              });
            }

            res.json({
              success: true,
              message: 'Trajet annulé avec succès'
            });
          });
        });
      });
    } catch (error) {
      console.error('Erreur annulation trajet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Supprimer définitivement un trajet (seulement si aucun booking actif)
  remove: async (req, res) => {
    try {
      const userId = req.userId;
      const rideId = req.params.id;

      // Vérifier que l'utilisateur est le conducteur
      const checkSql = `SELECT id FROM rides WHERE id = ? AND driver_id = ?`;
      db.get(checkSql, [rideId, userId], (err, ride) => {
        if (err || !ride) {
          return res.status(403).json({
            success: false,
            message: 'Trajet non trouvé ou vous n\'êtes pas le conducteur'
          });
        }

        // Vérifier qu'il n'y a pas de réservations actives
        const bookingsSql = `SELECT COUNT(*) as count FROM bookings WHERE ride_id = ? AND status IN ('pending','confirmed')`;
        db.get(bookingsSql, [rideId], (err, result) => {
          if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });

          if (result.count > 0) {
            return res.status(400).json({ success: false, message: 'Impossible de supprimer un trajet avec des réservations actives' });
          }

          // Supprimer définitivement
          db.run(`DELETE FROM rides WHERE id = ?`, [rideId], function(err) {
            if (err) {
              console.error('Erreur suppression trajet:', err);
              return res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
            }

            res.json({ success: true, message: 'Trajet supprimé avec succès' });
          });
        });
      });
    } catch (error) {
      console.error('Erreur suppression trajet:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // Marquer un trajet comme complété
  complete: async (req, res) => {
    try {
      const driverId = req.userId;
      const rideId = req.params.id;

      // Vérifier que l'utilisateur est le conducteur
      const checkSql = `SELECT id, status FROM rides WHERE id = ? AND driver_id = ?`;
      db.get(checkSql, [rideId, driverId], (err, ride) => {
        if (err || !ride) {
          return res.status(403).json({
            success: false,
            message: 'Trajet non trouvé ou vous n\'êtes pas le conducteur'
          });
        }

        if (ride.status === 'completed') {
          return res.status(400).json({
            success: false,
            message: 'Ce trajet est déjà marqué comme complété'
          });
        }

        if (ride.status === 'cancelled') {
          return res.status(400).json({
            success: false,
            message: 'Un trajet annulé ne peut pas être marqué comme complété'
          });
        }

        // Marquer le trajet comme complété
        const updateSql = `UPDATE rides SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(updateSql, [rideId], (err) => {
          if (err) {
            console.error('Erreur complétion trajet:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la mise à jour'
            });
          }

          // Mettre à jour les statistiques du conducteur
          const updateDriverSql = `UPDATE users SET total_trips = total_trips + 1 WHERE id = ?`;
          db.run(updateDriverSql, [driverId]);

          res.json({
            success: true,
            message: 'Trajet marqué comme complété avec succès'
          });
        });
      });
    } catch (error) {
      console.error('Erreur complétion trajet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

};

module.exports = rideController;