// models/ride.model.js - VERSION CORRIGÉE
const db = require('../config/db');

const Ride = {
  // Créer un trajet avec stations
  create: (rideData, callback) => {
    const { 
      driver_id, departure_station_id, arrival_station_id, 
      departure_date, departure_time, arrival_date, arrival_time,
      available_seats, price_per_seat, recurrence, recurrence_days, 
      recurrence_end_date, notes 
    } = rideData;
    
    const sql = `INSERT INTO rides 
                 (driver_id, departure_station_id, arrival_station_id, 
                  departure_date, departure_time, arrival_date, arrival_time,
                  available_seats, price_per_seat, recurrence, recurrence_days, 
                  recurrence_end_date, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const departureDateTime = `${departure_date} ${departure_time}`;
    const arrivalDateTime = arrival_date && arrival_time ? `${arrival_date} ${arrival_time}` : null;
    
    db.run(sql, [
      driver_id, departure_station_id, arrival_station_id,
      departureDateTime, departure_time, arrivalDateTime, arrival_time,
      available_seats, price_per_seat, recurrence || 'none', 
      recurrence_days ? JSON.stringify(recurrence_days) : null,
      recurrence_end_date, notes
    ], function(err) {
      if (err) return callback(err);
      
      const rideId = this.lastID;
      
      // Si c'est un trajet récurrent, générer les occurrences
      if (recurrence !== 'none' && recurrence_end_date) {
        Ride.generateRecurringRides(rideId, rideData, (err) => {
          if (err) console.error('Erreur génération trajets récurrents:', err);
          callback(err, { id: rideId });
        });
      } else {
        callback(null, { id: rideId });
      }
    });
  },

  // Générer les trajets récurrents
  generateRecurringRides: (parentRideId, rideData, callback) => {
    const { 
      departure_date, departure_time, recurrence, 
      recurrence_days, recurrence_end_date 
    } = rideData;
    
    // Logique de génération des dates récurrentes
    const dates = Ride.calculateRecurrenceDates(
      departure_date, recurrence, recurrence_days, recurrence_end_date
    );
    
    if (dates.length === 0) return callback();
    
    // Insérer chaque date générée
    const insertPromises = dates.map(date => {
      return new Promise((resolve, reject) => {
        const sql = `INSERT INTO generated_rides (parent_ride_id, departure_date) 
                     VALUES (?, ?)`;
        db.run(sql, [parentRideId, date], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    Promise.all(insertPromises)
      .then(() => callback())
      .catch(err => callback(err));
  },

  // Calculer les dates récurrentes
  calculateRecurrenceDates: (startDate, recurrence, days, endDate) => {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    switch(recurrence) {
      case 'daily':
        let current = new Date(start);
        while (current <= end) {
          dates.push(current.toISOString());
          current.setDate(current.getDate() + 1);
        }
        break;
        
      case 'weekly':
        if (!days || !Array.isArray(days)) break;
        const dayMap = {
          'monday': 1, 'tuesday': 2, 'wednesday': 3,
          'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0
        };
        
        let weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Dimanche
        
        while (weekStart <= end) {
          days.forEach(day => {
            const dayOffset = dayMap[day.toLowerCase()];
            if (dayOffset !== undefined) {
              const date = new Date(weekStart);
              date.setDate(date.getDate() + dayOffset);
              if (date >= start && date <= end) {
                dates.push(date.toISOString());
              }
            }
          });
          weekStart.setDate(weekStart.getDate() + 7);
        }
        break;
    }
    
    return dates;
  },

  // Recherche avancée de trajets
  searchAdvanced: (searchParams, callback) => {
    const {
      departure_station_id,
      arrival_station_id,
      departure_date,
      min_seats = 1,
      max_price,
      sort_by = 'departure_date',
      sort_order = 'ASC',
      page = 1,
      limit = 20
    } = searchParams;
    
    let sql = `SELECT r.*, 
                      d.first_name as driver_first_name,
                      d.last_name as driver_last_name,
                      d.rating as driver_rating,
                      d.total_trips as driver_trips,
                      ds.name as departure_station_name,
                      ds.city as departure_city,
                      ds.address as departure_address,
                      stat_arr.name as arrival_station_name,
                      stat_arr.city as arrival_city,
                      stat_arr.address as arrival_address,
                      (SELECT COUNT(*) FROM bookings b 
                       WHERE b.ride_id = r.id AND b.status IN ('confirmed', 'completed')) as booked_seats
               FROM rides r
               JOIN users d ON r.driver_id = d.id
               JOIN stations ds ON r.departure_station_id = ds.id
               JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
               WHERE r.status = 'active' 
               AND r.available_seats >= ?`;
    
    const params = [min_seats];
    
    if (departure_station_id) {
      sql += ` AND r.departure_station_id = ?`;
      params.push(departure_station_id);
    }
    
    if (arrival_station_id) {
      sql += ` AND r.arrival_station_id = ?`;
      params.push(arrival_station_id);
    }
    
    if (departure_date) {
      sql += ` AND DATE(r.departure_date) = DATE(?)`;
      params.push(departure_date);
    }
    
    if (max_price) {
      sql += ` AND r.price_per_seat <= ?`;
      params.push(max_price);
    }
    
    // Tri
    const sortMap = {
      'departure_date': 'r.departure_date',
      'price': 'r.price_per_seat',
      'seats': '(r.available_seats - booked_seats)',
      'rating': 'd.rating'
    };
    
    const sortField = sortMap[sort_by] || 'r.departure_date';
    sql += ` ORDER BY ${sortField} ${sort_order === 'DESC' ? 'DESC' : 'ASC'}`;
    
    // Pagination
    const offset = (page - 1) * limit;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    db.all(sql, params, (err, rides) => {
      if (err) return callback(err);
      
      // Compter le total pour la pagination
      let countSql = `SELECT COUNT(*) as total 
                      FROM rides r
                      WHERE r.status = 'active' 
                      AND r.available_seats >= ?`;
      
      const countParams = [min_seats];
      
      if (departure_station_id) {
        countSql += ` AND r.departure_station_id = ?`;
        countParams.push(departure_station_id);
      }
      
      if (arrival_station_id) {
        countSql += ` AND r.arrival_station_id = ?`;
        countParams.push(arrival_station_id);
      }
      
      if (departure_date) {
        countSql += ` AND DATE(r.departure_date) = DATE(?)`;
        countParams.push(departure_date);
      }
      
      if (max_price) {
        countSql += ` AND r.price_per_seat <= ?`;
        countParams.push(max_price);
      }
      
      db.get(countSql, countParams, (err, countResult) => {
        if (err) return callback(err);
        
        callback(null, {
          rides,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult.total,
            total_pages: Math.ceil(countResult.total / limit)
          }
        });
      });
    });
  },

  // Recherche par stations (auto-complétion)
  searchByStations: (departureQuery, arrivalQuery, date = null, callback) => {
    let sql = `SELECT r.*, 
                      ds.name as departure_station,
                      ds.city as departure_city,
                      stat_arr.name as arrival_station,
                      stat_arr.city as arrival_city,
                      d.first_name as driver_first_name,
                      d.last_name as driver_last_name,
                      d.rating as driver_rating
               FROM rides r
               JOIN stations ds ON r.departure_station_id = ds.id
               JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
               JOIN users d ON r.driver_id = d.id
               WHERE r.status = 'active' 
               AND r.available_seats > 0`;
    
    const params = [];
    
    if (departureQuery) {
      sql += ` AND (ds.name LIKE ? OR ds.city LIKE ?)`;
      params.push(`%${departureQuery}%`, `%${departureQuery}%`);
    }
    
    if (arrivalQuery) {
      sql += ` AND (stat_arr.name LIKE ? OR stat_arr.city LIKE ?)`;
      params.push(`%${arrivalQuery}%`, `%${arrivalQuery}%`);
    }
    
    if (date) {
      sql += ` AND DATE(r.departure_date) = DATE(?)`;
      params.push(date);
    }
    
    sql += ` ORDER BY r.departure_date ASC LIMIT 50`;
    
    db.all(sql, params, callback);
  },

  // Obtenir les détails d'un trajet
  findById: (id, callback) => {
    const sql = `SELECT r.*,
                        d.id as driver_id,
                        d.first_name as driver_first_name,
                        d.last_name as driver_last_name,
                        d.phone as driver_phone,
                        d.rating as driver_rating,
                        d.total_trips,
                        d.is_driver,
                        ds.name as departure_station_name,
                        ds.city as departure_city,
                        ds.address as departure_address,
                        ds.latitude as departure_lat,
                        ds.longitude as departure_lng,
                        stat_arr.name as arrival_station_name,
                        stat_arr.city as arrival_city,
                        stat_arr.address as arrival_address,
                        stat_arr.latitude as arrival_lat,
                        stat_arr.longitude as arrival_lng,
                        (SELECT COUNT(*) FROM bookings b 
                         WHERE b.ride_id = r.id AND b.status IN ('confirmed', 'completed')) as booked_seats
                 FROM rides r
                 JOIN users d ON r.driver_id = d.id
                 JOIN stations ds ON r.departure_station_id = ds.id
                 JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
                 WHERE r.id = ?`;
    
    db.get(sql, [id], callback);
  },

  // Trajets similaires (même itinéraire)
  findSimilar: (departureStationId, arrivalStationId, excludeRideId = null, limit = 5, callback) => {
    let sql = `SELECT r.*, 
                      d.first_name, d.last_name, d.rating as driver_rating,
                      ds.name as departure_station,
                      stat_arr.name as arrival_station
               FROM rides r
               JOIN users d ON r.driver_id = d.id
               JOIN stations ds ON r.departure_station_id = ds.id
               JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
               WHERE r.departure_station_id = ? 
               AND r.arrival_station_id = ?
               AND r.status = 'active'
               AND r.available_seats > 0`;
    
    const params = [departureStationId, arrivalStationId];
    
    if (excludeRideId) {
      sql += ` AND r.id != ?`;
      params.push(excludeRideId);
    }
    
    sql += ` ORDER BY r.departure_date ASC LIMIT ?`;
    params.push(limit);
    
    db.all(sql, params, callback);
  },

  // Obtenir les trajets récurrents actifs d'un utilisateur
  getRecurringRides: (driverId, callback) => {
    const sql = `SELECT r.*,
                        ds.name as departure_station,
                        stat_arr.name as arrival_station,
                        COUNT(gr.id) as generated_count
                 FROM rides r
                 JOIN stations ds ON r.departure_station_id = ds.id
                 JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
                 LEFT JOIN generated_rides gr ON r.id = gr.parent_ride_id
                 WHERE r.driver_id = ? 
                 AND r.recurrence != 'none'
                 AND r.status = 'active'
                 GROUP BY r.id
                 ORDER BY r.departure_date`;
    
    db.all(sql, [driverId], callback);
  },

  // Générer les trajets récurrents pour la semaine à venir
  generateWeeklyRecurringRides: (callback) => {
    const sql = `
      INSERT INTO generated_rides (parent_ride_id, departure_date)
      SELECT r.id, 
             DATE(r.departure_date, '+' || (julianday('now') - julianday(r.departure_date)) || ' days')
      FROM rides r
      WHERE r.recurrence != 'none'
      AND r.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM generated_rides gr 
        WHERE gr.parent_ride_id = r.id 
        AND DATE(gr.departure_date) = DATE('now', 'weekday ' || 
          CASE r.recurrence_days 
            WHEN '["monday"]' THEN 1
            WHEN '["tuesday"]' THEN 2
            WHEN '["wednesday"]' THEN 3
            WHEN '["thursday"]' THEN 4
            WHEN '["friday"]' THEN 5
            WHEN '["saturday"]' THEN 6
            WHEN '["sunday"]' THEN 0
            ELSE 1
          END)
      )
      AND DATE('now') <= DATE(r.recurrence_end_date)`;
    
    db.run(sql, callback);
  },

  // Mettre à jour le statut d'un trajet (ex: complété, annulé)
  updateStatus: (rideId, status, callback) => {
    const sql = `UPDATE rides SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [status, rideId], callback);
  },

  // Obtenir les trajets disponibles pour aujourd'hui
  getTodayRides: (callback) => {
    const sql = `SELECT r.*,
                        d.first_name as driver_first_name,
                        d.last_name as driver_last_name,
                        d.rating as driver_rating,
                        ds.name as departure_station,
                        stat_arr.name as arrival_station
                 FROM rides r
                 JOIN users d ON r.driver_id = d.id
                 JOIN stations ds ON r.departure_station_id = ds.id
                 JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
                 WHERE r.status = 'active'
                 AND DATE(r.departure_date) = DATE('now')
                 AND r.available_seats > 0
                 ORDER BY r.departure_time`;
    
    db.all(sql, callback);
  }
};

module.exports = Ride;