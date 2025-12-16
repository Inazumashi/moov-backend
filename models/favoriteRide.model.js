const db = require('../config/db');

const FavoriteRide = {
  // Ajouter un trajet aux favoris
  add: (userId, rideId, callback) => {
    // D'abord vérifier si déjà en favoris
    const checkSql = 'SELECT id FROM favorite_rides WHERE user_id = ? AND ride_id = ?';
    db.get(checkSql, [userId, rideId], (err, existing) => {
      if (err) return callback(err);
      if (existing) return callback(new Error('Trajet déjà dans les favoris'));
      const sql = 'INSERT INTO favorite_rides (user_id, ride_id) VALUES (?, ?)';
      db.run(sql, [userId, rideId], function(err) {
        if (err) return callback(err);
        callback(null, { id: this.lastID });
      });
    });
  },

  // ✅ CORRECTION : Supprimer un favori
  remove: (userId, rideId, callback) => {
    console.log(`🗑️ Suppression favori: userId=${userId}, rideId=${rideId}`);
    // Vérifier d'abord si le favori existe
    const checkSql = 'SELECT id FROM favorite_rides WHERE user_id = ? AND ride_id = ?';
    db.get(checkSql, [userId, rideId], (err, favorite) => {
      if (err) {
        console.error('❌ Erreur vérification favori:', err);
        return callback(err);
      }
      if (!favorite) {
        console.log('⚠️ Favori non trouvé');
        return callback(new Error('Favori non trouvé'));
      }
      console.log(`✅ Favori trouvé, ID: ${favorite.id}`);
      // Supprimer le favori
      const sql = 'DELETE FROM favorite_rides WHERE user_id = ? AND ride_id = ?';
      db.run(sql, [userId, rideId], function(err) {
        if (err) {
          console.error('❌ Erreur suppression:', err);
          return callback(err);
        }
        console.log(`✅ Favori supprimé, changes: ${this.changes}`);
        if (this.changes === 0) {
          return callback(new Error('Aucun favori supprimé'));
        }
        callback(null, { deleted: true, changes: this.changes });
      });
    });
  },

  // Obtenir les favoris d'un utilisateur
  getByUser: (userId, callback) => {
    const sql = `
      SELECT 
        fr.id as favorite_id,
        fr.created_at as favorited_at,
        r.*,
        u.first_name as driver_first_name,
        u.last_name as driver_last_name,
        u.rating as driver_rating,
        u.is_driver as driver_is_driver,
        ds.name as departure_station,
        ds.city as departure_city,
        ars.name as arrival_station,
        ars.city as arrival_city,
        (SELECT COUNT(*) FROM bookings b 
         WHERE b.ride_id = r.id AND b.status IN ('confirmed', 'completed')) as booked_seats
      FROM favorite_rides fr
      JOIN rides r ON fr.ride_id = r.id
      JOIN users u ON r.driver_id = u.id
      JOIN stations ds ON r.departure_station_id = ds.id
      JOIN stations ars ON r.arrival_station_id = ars.id
      WHERE fr.user_id = ?
      AND r.status IN ('active', 'pending')
      ORDER BY fr.created_at DESC
    `;
    db.all(sql, [userId], (err, favorites) => {
      if (err) {
        console.error('Erreur récupération favoris:', err);
        return callback(err);
      }
      console.log(`✅ ${favorites.length} favoris trouvés pour user ${userId}`);
      callback(null, favorites);
    });
  },

  // Vérifier si un trajet est en favoris
  isFavorite: (userId, rideId, callback) => {
    const sql = 'SELECT id FROM favorite_rides WHERE user_id = ? AND ride_id = ?';
    db.get(sql, [userId, rideId], (err, favorite) => {
      if (err) return callback(err);
      callback(null, !!favorite);
    });
  }
};

module.exports = FavoriteRide;