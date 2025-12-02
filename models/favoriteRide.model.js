const db = require('../config/db');

const FavoriteRide = {
  // Ajouter un trajet aux favoris
  add: (userId, rideId, callback) => {
    const sql = `INSERT OR IGNORE INTO favorite_rides (user_id, ride_id) VALUES (?, ?)`;
    db.run(sql, [userId, rideId], callback);
  },

  // Retirer des favoris
  remove: (userId, rideId, callback) => {
    const sql = `DELETE FROM favorite_rides WHERE user_id = ? AND ride_id = ?`;
    db.run(sql, [userId, rideId], callback);
  },

  // Obtenir les trajets favoris
  getByUser: (userId, callback) => {
    const sql = `SELECT fr.*, 
                        r.departure_station_id, r.arrival_station_id, r.departure_date, r.departure_time,
                        r.available_seats, r.price_per_seat, r.status,
                        ds.name as departure_station,
                        as.name as arrival_station,
                        u.first_name as driver_first_name, u.last_name as driver_last_name,
                        u.rating as driver_rating
                 FROM favorite_rides fr
                 JOIN rides r ON fr.ride_id = r.id
                 JOIN stations ds ON r.departure_station_id = ds.id
                 JOIN stations as ON r.arrival_station_id = as.id
                 JOIN users u ON r.driver_id = u.id
                 WHERE fr.user_id = ?
                 ORDER BY fr.created_at DESC`;
    
    db.all(sql, [userId], callback);
  },

  // Vérifier si un trajet est en favoris
  isFavorite: (userId, rideId, callback) => {
    const sql = `SELECT id FROM favorite_rides WHERE user_id = ? AND ride_id = ?`;
    db.get(sql, [userId, rideId], (err, result) => {
      callback(err, !!result);
    });
  }
};

module.exports = FavoriteRide;