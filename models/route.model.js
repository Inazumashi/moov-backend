// models/route.model.js
const db = require('../config/db');

const Route = {
  // Mettre à jour/mettre à jour les itinéraires populaires
  updatePopularRoute: (departureStationId, arrivalStationId, callback) => {
    // Vérifier si l'itinéraire existe
    const checkSql = `SELECT id FROM popular_routes 
                      WHERE departure_station_id = ? 
                      AND arrival_station_id = ?`;
    
    db.get(checkSql, [departureStationId, arrivalStationId], (err, existing) => {
      if (err) return callback(err);
      
      if (existing) {
        // Mettre à jour l'existant
        const updateSql = `UPDATE popular_routes 
                          SET search_count = search_count + 1,
                              last_searched = CURRENT_TIMESTAMP,
                              ride_count = (
                                SELECT COUNT(*) FROM rides 
                                WHERE departure_station_id = ? 
                                AND arrival_station_id = ?
                                AND status = 'active'
                              )
                          WHERE id = ?`;
        
        db.run(updateSql, [departureStationId, arrivalStationId, existing.id], callback);
      } else {
        // Créer un nouvel itinéraire
        const insertSql = `INSERT INTO popular_routes 
                          (departure_station_id, arrival_station_id, search_count, last_searched) 
                          VALUES (?, ?, 1, CURRENT_TIMESTAMP)`;
        
        db.run(insertSql, [departureStationId, arrivalStationId], callback);
      }
    });
  },

  // Obtenir les itinéraires populaires
  getPopularRoutes: (limit = 10, callback) => {
    const sql = `SELECT pr.*,
                        ds.name as departure_station_name,
                        ds.city as departure_city,
                        as.name as arrival_station_name,
                        as.city as arrival_city,
                        COUNT(DISTINCT r.id) as total_rides,
                        AVG(r.price_per_seat) as avg_price
                 FROM popular_routes pr
                 JOIN stations ds ON pr.departure_station_id = ds.id
                 JOIN stations as ON pr.arrival_station_id = as.id
                 LEFT JOIN rides r ON (r.departure_station_id = pr.departure_station_id 
                                       AND r.arrival_station_id = pr.arrival_station_id
                                       AND r.status = 'active')
                 GROUP BY pr.id
                 ORDER BY pr.search_count DESC, pr.ride_count DESC
                 LIMIT ?`;
    
    db.all(sql, [limit], callback);
  },

  // Itinéraires suggérés basés sur l'historique
  getSuggestedRoutes: (userId, limit = 5, callback) => {
    const sql = `SELECT DISTINCT 
                        r.departure_station_id,
                        r.arrival_station_id,
                        ds.name as departure_station,
                        as.name as arrival_station,
                        COUNT(*) as frequency
                 FROM rides r
                 JOIN stations ds ON r.departure_station_id = ds.id
                 JOIN stations as ON r.arrival_station_id = as.id
                 WHERE r.driver_id = ?
                 GROUP BY r.departure_station_id, r.arrival_station_id
                 ORDER BY frequency DESC
                 LIMIT ?`;
    
    db.all(sql, [userId, limit], callback);
  }
};

module.exports = Route;