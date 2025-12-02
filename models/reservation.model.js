const db = require('../config/db');

const Reservation = {
  // Créer une réservation (transaction)
  create: (reservationData, callback) => {
    const { rideId, passengerId, seatsBooked } = reservationData;
    
    // Transaction pour garantir l'intégrité
    db.serialize(() => {
      // 1. Vérifier que le trajet existe et a des places
      db.get(`SELECT available_seats, price_per_seat FROM rides WHERE id = ? AND status = 'active'`, 
        [rideId], (err, ride) => {
          if (err) return callback(err);
          if (!ride) return callback(new Error('Trajet non trouvé ou inactif'));
          
          // 2. Vérifier les places disponibles
          if (ride.available_seats < seatsBooked) {
            return callback(new Error('Pas assez de places disponibles'));
          }
          
          // 3. Calculer le prix total
          const totalPrice = ride.price_per_seat * seatsBooked;
          
          // 4. Réserver (dans une transaction)
          db.run(`BEGIN TRANSACTION`);
          
          // Diminuer les places disponibles
          db.run(`UPDATE rides SET available_seats = available_seats - ? WHERE id = ?`, 
            [seatsBooked, rideId], (err) => {
              if (err) {
                db.run(`ROLLBACK`);
                return callback(err);
              }
              
              // Créer la réservation
              db.run(`INSERT INTO bookings (ride_id, passenger_id, seats_booked, total_price) 
                      VALUES (?, ?, ?, ?)`, 
                [rideId, passengerId, seatsBooked, totalPrice], 
                function(err) {
                  if (err) {
                    db.run(`ROLLBACK`);
                    return callback(err);
                  }
                  
                  db.run(`COMMIT`);
                  callback(null, { 
                    id: this.lastID, 
                    totalPrice,
                    seatsBooked 
                  });
                }
              );
            }
          );
        }
      );
    });
  },

  // Annuler une réservation
  cancel: (bookingId, passengerId, reason = null, callback) => {
    // Vérifier que la réservation appartient au passager
    db.get(`SELECT ride_id, seats_booked FROM bookings WHERE id = ? AND passenger_id = ?`, 
      [bookingId, passengerId], (err, booking) => {
        if (err) return callback(err);
        if (!booking) return callback(new Error('Réservation non trouvée'));
        
        db.serialize(() => {
          db.run(`BEGIN TRANSACTION`);
          
          // Rendre les places disponibles
          db.run(`UPDATE rides SET available_seats = available_seats + ? WHERE id = ?`, 
            [booking.seats_booked, booking.ride_id], (err) => {
              if (err) {
                db.run(`ROLLBACK`);
                return callback(err);
              }
              
              // Marquer comme annulée
              db.run(`UPDATE bookings 
                      SET status = 'cancelled', 
                          cancellation_date = CURRENT_TIMESTAMP,
                          cancellation_reason = ?
                      WHERE id = ?`, 
                [reason, bookingId], (err) => {
                  if (err) {
                    db.run(`ROLLBACK`);
                    return callback(err);
                  }
                  
                  db.run(`COMMIT`);
                  callback(null, { success: true });
                }
              );
            }
          );
        });
      }
    );
  },

  // Obtenir les réservations d'un passager
  findByPassenger: (passengerId, status = null, callback) => {
    let sql = `SELECT b.*, 
                      r.departure_station_id, r.arrival_station_id, r.departure_date, r.departure_time,
                      r.driver_id, r.price_per_seat,
                      ds.name as departure_station_name,
                      as.name as arrival_station_name,
                      u.first_name as driver_first_name, u.last_name as driver_last_name
               FROM bookings b
               JOIN rides r ON b.ride_id = r.id
               JOIN stations ds ON r.departure_station_id = ds.id
               JOIN stations as ON r.arrival_station_id = as.id
               JOIN users u ON r.driver_id = u.id
               WHERE b.passenger_id = ?`;
    
    const params = [passengerId];
    
    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }
    
    sql += ` ORDER BY b.booking_date DESC`;
    
    db.all(sql, params, callback);
  },

  // Obtenir les réservations d'un trajet (pour le conducteur)
  findByRide: (rideId, callback) => {
    const sql = `SELECT b.*, 
                        u.first_name, u.last_name, u.phone, u.email
                 FROM bookings b
                 JOIN users u ON b.passenger_id = u.id
                 WHERE b.ride_id = ?
                 ORDER BY b.booking_date`;
    db.all(sql, [rideId], callback);
  },

  // Vérifier si un utilisateur a déjà réservé un trajet
  hasBooked: (rideId, passengerId, callback) => {
    const sql = `SELECT id FROM bookings WHERE ride_id = ? AND passenger_id = ? AND status != 'cancelled'`;
    db.get(sql, [rideId, passengerId], (err, row) => {
      callback(err, !!row);
    });
  }
};

module.exports = Reservation;