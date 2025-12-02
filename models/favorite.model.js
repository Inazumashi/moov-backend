// models/favorite.model.js
const db = require('../config/db');

const Favorite = {
  // Ajouter une station aux favoris
  addStation: (userId, stationId, type = 'both', callback) => {
    const sql = `INSERT OR REPLACE INTO favorite_stations 
                 (user_id, station_id, type) 
                 VALUES (?, ?, ?)`;
    db.run(sql, [userId, stationId, type], callback);
  },

  // Retirer une station des favoris
  removeStation: (userId, stationId, type = null, callback) => {
    let sql = `DELETE FROM favorite_stations 
               WHERE user_id = ? AND station_id = ?`;
    const params = [userId, stationId];
    
    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }
    
    db.run(sql, params, callback);
  },

  // Obtenir les stations favorites d'un utilisateur
  getUserStations: (userId, type = null, callback) => {
    let sql = `SELECT fs.*, s.name, s.city, s.type as station_type, 
                      s.latitude, s.longitude, u.name as university_name
               FROM favorite_stations fs
               JOIN stations s ON fs.station_id = s.id
               LEFT JOIN universities u ON s.university_id = u.id
               WHERE fs.user_id = ?`;
    
    const params = [userId];
    
    if (type) {
      sql += ` AND fs.type IN (?, 'both')`;
      params.push(type);
    }
    
    sql += ` ORDER BY fs.created_at DESC`;
    
    db.all(sql, params, callback);
  },

  // Vérifier si une station est en favoris
  isFavorite: (userId, stationId, callback) => {
    const sql = `SELECT id FROM favorite_stations 
                 WHERE user_id = ? AND station_id = ?`;
    db.get(sql, [userId, stationId], (err, result) => {
      callback(err, !!result);
    });
  }
};

module.exports = Favorite;