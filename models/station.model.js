// models/station.model.js - VERSION COMPLÈTE AMÉLIORÉE
const db = require('../config/db');

const Station = {
  // Recherche avec auto-complétion - VERSION AMÉLIORÉE
  search: (query, limit = 10, userId = null, callback) => {
    let sql = `SELECT s.*, 
                      u.name as university_name,
                      (SELECT COUNT(*) FROM favorite_stations fs 
                       WHERE fs.station_id = s.id AND fs.user_id = ?) as is_favorite,
                      (SELECT COUNT(*) FROM rides r 
                       WHERE r.departure_station_id = s.id 
                       OR r.arrival_station_id = s.id) as ride_count
               FROM stations s
               LEFT JOIN universities u ON s.university_id = u.id
               WHERE s.is_active = 1 
               AND (s.name LIKE ? OR s.city LIKE ? OR s.address LIKE ?)`;
    
    const params = [userId || 0, `%${query}%`, `%${query}%`, `%${query}%`];
    
    // Amélioration : recherche par mots clés communs
    const keywords = query.toLowerCase().split(' ');
    keywords.forEach(keyword => {
      if (keyword.length > 2) {
        sql += ` OR LOWER(s.name) LIKE ? OR LOWER(s.city) LIKE ?`;
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
    });
    
    // Si l'utilisateur est connecté, on peut filtrer par ses universités favorites
    if (userId) {
      sql += ` OR s.university_id IN (
                SELECT university_id FROM user_universities WHERE user_id = ?
              )`;
      params.push(userId);
    }
    
    sql += ` ORDER BY 
               CASE 
                 WHEN s.name LIKE ? THEN 1
                 WHEN LOWER(s.name) LIKE LOWER(?) THEN 2
                 WHEN s.city LIKE ? THEN 3
                 WHEN s.address LIKE ? THEN 4
                 ELSE 5
               END,
               s.search_count DESC,
               ride_count DESC,
               s.name ASC
             LIMIT ?`;
    
    params.push(`${query}%`, `${query}%`, `${query}%`, `${query}%`, limit);
    
    db.all(sql, params, (err, stations) => {
      if (err) return callback(err);
      
      // Formater les résultats
      const formattedStations = stations.map(station => ({
        ...station,
        display_name: `${station.name} - ${station.city}` +
          (station.university_name ? ` (${station.university_name})` : '') +
          (station.type === 'university' ? ' 🎓' : 
           station.type === 'train_station' ? ' 🚂' : 
           station.type === 'bus_station' ? ' 🚌' : ' 📍')
      }));
      
      // Incrémenter le compteur de recherche
      stations.forEach(station => {
        db.run(`UPDATE stations SET search_count = search_count + 1 WHERE id = ?`, 
          [station.id]);
      });
      
      callback(null, formattedStations);
    });
  },

  // NOUVELLE MÉTHODE : Recherche par type
  searchByType: (query, type, limit = 10, callback) => {
    const sql = `SELECT s.*, u.name as university_name
                 FROM stations s
                 LEFT JOIN universities u ON s.university_id = u.id
                 WHERE s.is_active = 1 
                 AND s.type = ?
                 AND (s.name LIKE ? OR s.city LIKE ?)
                 ORDER BY s.search_count DESC, s.name
                 LIMIT ?`;
    
    db.all(sql, [type, `%${query}%`, `%${query}%`, limit], callback);
  },

  // Recherche géographique (stations proches)
  searchNearby: (latitude, longitude, radiusKm = 10, limit = 20, callback) => {
    // Formule haversine pour calculer la distance
    const sql = `SELECT s.*, 
                        (6371 * acos(
                          cos(radians(?)) * cos(radians(s.latitude)) * 
                          cos(radians(s.longitude) - radians(?)) + 
                          sin(radians(?)) * sin(radians(s.latitude))
                        )) as distance_km
                 FROM stations s
                 WHERE s.latitude IS NOT NULL 
                 AND s.longitude IS NOT NULL
                 AND s.is_active = 1
                 HAVING distance_km <= ?
                 ORDER BY distance_km
                 LIMIT ?`;
    
    db.all(sql, [latitude, longitude, latitude, radiusKm, limit], callback);
  },

  // Obtenir les stations d'une université
  getByUniversity: (universityId, callback) => {
    const sql = `SELECT s.*, u.name as university_name
                 FROM stations s
                 JOIN universities u ON s.university_id = u.id
                 WHERE s.university_id = ? AND s.is_active = 1
                 ORDER BY 
                   CASE s.type 
                     WHEN 'university' THEN 1
                     WHEN 'train_station' THEN 2
                     WHEN 'bus_station' THEN 3
                     ELSE 4
                   END,
                   s.name`;
    db.all(sql, [universityId], callback);
  },

  // Obtenir toutes les stations d'une ville
  getByCity: (city, callback) => {
    const sql = `SELECT s.*, u.name as university_name
                 FROM stations s
                 LEFT JOIN universities u ON s.university_id = u.id
                 WHERE s.city LIKE ? AND s.is_active = 1
                 ORDER BY s.search_count DESC, s.name
                 LIMIT 50`;
    db.all(sql, [`%${city}%`], callback);
  },

  // Créer une station
  create: (stationData, callback) => {
    const { name, type, city, address, latitude, longitude, university_id } = stationData;
    const sql = `INSERT INTO stations 
                 (name, type, city, address, latitude, longitude, university_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [name, type, city, address, latitude, longitude, university_id], 
      function(err) {
        callback(err, { id: this.lastID });
      }
    );
  },

  // Obtenir une station par ID
  findById: (id, callback) => {
    const sql = `SELECT s.*, u.name as university_name
                 FROM stations s
                 LEFT JOIN universities u ON s.university_id = u.id
                 WHERE s.id = ?`;
    db.get(sql, [id], callback);
  },

  // Stations populaires (les plus recherchées)
  getPopular: (limit = 10, callback) => {
    const sql = `SELECT s.*, COUNT(DISTINCT r.id) as ride_count
                 FROM stations s
                 LEFT JOIN rides r ON (r.departure_station_id = s.id OR r.arrival_station_id = s.id)
                 WHERE s.is_active = 1
                 GROUP BY s.id
                 ORDER BY s.search_count DESC, ride_count DESC
                 LIMIT ?`;
    db.all(sql, [limit], callback);
  },

  // Stations récentes (pour l'historique)
  getRecent: (userId, limit = 10, callback) => {
    const sql = `SELECT DISTINCT s.*
                 FROM stations s
                 WHERE s.id IN (
                   SELECT departure_station_id FROM rides WHERE driver_id = ?
                   UNION
                   SELECT arrival_station_id FROM rides WHERE driver_id = ?
                   UNION
                   SELECT r.departure_station_id FROM bookings b
                   JOIN rides r ON b.ride_id = r.id
                   WHERE b.passenger_id = ?
                   UNION
                   SELECT r.arrival_station_id FROM bookings b
                   JOIN rides r ON b.ride_id = r.id
                   WHERE b.passenger_id = ?
                 )
                 ORDER BY s.updated_at DESC
                 LIMIT ?`;
    
    db.all(sql, [userId, userId, userId, userId, limit], callback);
  },

  // Mettre à jour le compteur de recherche
  incrementSearchCount: (stationId, callback) => {
    const sql = `UPDATE stations 
                 SET search_count = search_count + 1, 
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`;
    db.run(sql, [stationId], callback);
  }
};

module.exports = Station;