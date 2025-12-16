const db = require('../config/db');
const util = require('util');

// Promisification des méthodes nécessaires si ce n'est pas déjà fait
const dbGet = util.promisify(db.get);
const dbRun = util.promisify(db.run);
const dbAll = util.promisify(db.all);

const Reservation = {
  // Créer une réservation (utilise Promise pour gérer la transaction)
  create: (reservationData) => {
    return new Promise(async (resolve, reject) => {
      const { rideId, passengerId, seatsBooked } = reservationData;

      try {
        // 1. Vérifier que le trajet existe et a des places
        const ride = await dbGet(`SELECT available_seats, price_per_seat FROM rides WHERE id = ? AND status = 'active'`,
          [rideId]);

        if (!ride) {
          return reject(new Error('Trajet non trouvé ou inactif'));
        }

        // 2. Vérifier les places disponibles
        if (ride.available_seats < seatsBooked) {
          return reject(new Error(`Pas assez de places disponibles. Seulement ${ride.available_seats} restantes.`));
        }

        const totalPrice = ride.price_per_seat * seatsBooked;

        // Début de la transaction
        await dbRun(`BEGIN TRANSACTION`);

        try {
          // Diminuer les places disponibles
          await dbRun(`UPDATE rides SET available_seats = available_seats - ? WHERE id = ?`,
            [seatsBooked, rideId]);

          // Créer la réservation
          const insertResult = await dbRun(`INSERT INTO bookings (ride_id, passenger_id, seats_booked, total_price) 
                                           VALUES (?, ?, ?, ?)`,
            [rideId, passengerId, seatsBooked, totalPrice]);

          await dbRun(`COMMIT`);

          resolve({
            id: insertResult.lastID, // lastID est accessible via la méthode promisifiée dbRun
            totalPrice,
            seatsBooked
          });

        } catch (txnError) {
          // Gérer le rollback en cas d'erreur de transaction
          await dbRun(`ROLLBACK`);
          reject(txnError);
        }

      } catch (error) {
        reject(error);
      }
    });
  },

  // Annuler une réservation (promisifiée et transactionnelle)
  cancel: (bookingId, passengerId, reason = null) => {
    return new Promise(async (resolve, reject) => {
      try {
        // 1. Vérifier l'appartenance et récupérer les données
        const booking = await dbGet(`SELECT ride_id, seats_booked, status FROM bookings WHERE id = ? AND passenger_id = ?`,
          [bookingId, passengerId]);

        if (!booking) {
          return reject(new Error('Réservation non trouvée ou non autorisée'));
        }
        if (booking.status === 'cancelled') {
          return reject(new Error('La réservation est déjà annulée'));
        }
        if (booking.status === 'completed') {
          return reject(new Error('Impossible d\'annuler une réservation complétée'));
        }

        await dbRun(`BEGIN TRANSACTION`);

        try {
          // Rendre les places disponibles
          await dbRun(`UPDATE rides SET available_seats = available_seats + ? WHERE id = ?`,
            [booking.seats_booked, booking.ride_id]);

          // Marquer comme annulée
          await dbRun(`UPDATE bookings 
                       SET status = 'cancelled', 
                           cancellation_date = CURRENT_TIMESTAMP,
                           cancellation_reason = ?
                       WHERE id = ?`,
            [reason, bookingId]);

          await dbRun(`COMMIT`);
          resolve({ success: true });

        } catch (txnError) {
          await dbRun(`ROLLBACK`);
          reject(txnError);
        }

      } catch (error) {
        reject(error);
      }
    });
  },

  // Obtenir les réservations d'un passager (promisifiée, utilise la colonne 'seats_booked' corrigée)
  findByPassenger: (passengerId, status = null) => {
    let sql = `SELECT 
             b.id, b.ride_id, b.passenger_id, b.seats_booked, b.status, b.total_price, 
             b.booking_date, b.cancellation_date, b.cancellation_reason, b.completed_at,
             r.departure_station_id, r.arrival_station_id, r.departure_date, r.departure_time,
             r.driver_id, r.price_per_seat,
             ds.name as departure_station_name,
             stat_arr.name as arrival_station_name,
             u.first_name as driver_first_name, u.last_name as driver_last_name
          FROM bookings b
          JOIN rides r ON b.ride_id = r.id
          JOIN stations ds ON r.departure_station_id = ds.id
          JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
          JOIN users u ON r.driver_id = u.id
          WHERE b.passenger_id = ?`;

    const params = [passengerId];

    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY b.booking_date DESC`;

    return dbAll(sql, params); // dbAll promisifié retourne la Promise directement
  },

  // Obtenir les réservations d'un trajet (pour le conducteur)
  findByRide: (rideId) => {
    const sql = `SELECT b.*, 
                        u.first_name, u.last_name, u.phone, u.email
                 FROM bookings b
                 JOIN users u ON b.passenger_id = u.id
                 WHERE b.ride_id = ?
                 ORDER BY b.booking_date`;
    return dbAll(sql, [rideId]);
  },

  // Vérifier si un utilisateur a déjà réservé un trajet
  hasBooked: async (rideId, passengerId) => {
    const sql = `SELECT id FROM bookings WHERE ride_id = ? AND passenger_id = ? AND status != 'cancelled'`;
    const row = await dbGet(sql, [rideId, passengerId]);
    return !!row;
  }
};

module.exports = Reservation;