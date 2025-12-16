// models/station.model.js - VERSION COMPLÈTE AMÉLIORÉE
const db = require('../config/db');

const Station = {
  // Helper: dédupliquer une liste de stations (normalise name|city|address)
  _dedupeStations: (stations, opts = {}) => {
    // opts.query: optional original query string to prefer exact matches
    const groups = new Map();
    (stations || []).forEach(s => {
      const key = `${(s.name||'').trim().toLowerCase()}|${(s.city||'').trim().toLowerCase()}|${(s.address||'').trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });

    const query = (opts.query || '').trim().toLowerCase();
    const unique = [];

    for (const [key, items] of groups.entries()) {
      if (items.length === 1) {
        unique.push(items[0]);
        continue;
      }

      // Choose best candidate within duplicates
      let best = items[0];
      const qToken = (query.split(',')[0].split(' ')[0] || query).trim();

      const scoreOf = (st) => {
        const name = (st.name||'').trim().toLowerCase();
        const city = (st.city||'').trim().toLowerCase();
        const token = (qToken||'').toLowerCase();
        let score = 0;

        // Exact full-match is best
        if (token && name === token) score += 120;

        // Prefer when station name starts with the token
        if (token && name.startsWith(token)) score += 60;

        // If station defines aliases, prefer exact alias matches
        if (st.aliases) {
          const aliases = (st.aliases || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
          if (aliases.includes(token)) {
            score += 300; // very strong boost for exact alias match
          } else if (aliases.some(a => a.startsWith(token) || a.includes(token))) {
            score += 80;
          }
        }

        // If token is short (acronym/abbr), prefer stations containing that token as a standalone word
        if (token && token.length <= 4) {
          const nameWords = name.replace(/[-_]/g, ' ').split(/\s+/).map(w => w.trim()).filter(Boolean);
          if (nameWords.includes(token)) score += 90; // strong boost for acronym match (EMI, UCA, etc.)
          if (name.includes(token)) score += 25; // loose match
        } else {
          if (token && name.includes(token)) score += 30;
        }

        // City exact match
        if (token && city === token) score += 20;

        // Slight preference for university-linked stations
        if (st.university_name) score += 5;

        // Lower id preferred as tiny tie-breaker
        score -= (st.id || 0) / 1000000;
        return score;
      };

      let bestScore = scoreOf(best);
      for (let i = 1; i < items.length; i++) {
        const s = items[i];
        const sc = scoreOf(s);
        if (sc > bestScore) {
          best = s;
          bestScore = sc;
        }
      }

      unique.push(best);
    }

    return unique;
  },
  // Score a single station against a query (used to rank results globally)
  _scoreStation: (st, query) => {
    const q = (query || '').trim().toLowerCase();
    const qToken = (q.split(',')[0].split(' ')[0] || q).trim();
    const name = (st.name||'').trim().toLowerCase();
    const city = (st.city||'').trim().toLowerCase();
    const token = (qToken||'').toLowerCase();
    let score = 0;

    if (st.aliases) {
      const aliases = (st.aliases || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      if (aliases.includes(token)) score += 300;
      else if (aliases.some(a => a.startsWith(token) || a.includes(token))) score += 80;
    }

    if (token && name === token) score += 120;
    if (token && name.startsWith(token)) score += 60;

    if (token && token.length <= 4) {
      const nameWords = name.replace(/[-_]/g, ' ').split(/\s+/).map(w => w.trim()).filter(Boolean);
      if (nameWords.includes(token)) score += 90;
      if (name.includes(token)) score += 25;
    } else {
      if (token && name.includes(token)) score += 30;
    }

    if (token && city === token) score += 20;
    if (st.university_name) score += 5;
    score -= (st.id || 0) / 1000000;
    return score;
  },
  // Recherche avec auto-complétion - VERSION AMÉLIORÉE
  search: (query, limit = 10, userId = null, callback) => {
    // Early alias-aware short-token fast-path: prefer exact alias/name matches for short tokens (e.g., 'EMI')
    const norm = (query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = norm.split(/\s+/).map(t => t.trim()).filter(Boolean);
    const shortToken = tokens.find(t => t.length > 0 && t.length <= 4);
    if (shortToken) {
      const aliasSql = `SELECT s.*, u.name as university_name
                        FROM stations s
                        LEFT JOIN universities u ON s.university_id = u.id
                        WHERE s.is_active = 1 AND (
                          LOWER(s.aliases) LIKE ? OR LOWER(s.name) = ? OR LOWER(s.name) LIKE ?
                        ) ORDER BY s.search_count DESC, s.name ASC LIMIT ?`;
      const aliasParams = [`%${shortToken}%`, shortToken, `${shortToken}%`, limit];
      return db.all(aliasSql, aliasParams, (err, rows) => {
        if (!err && rows && rows.length > 0) {
          try {
            const deduped = Station._dedupeStations(rows, { query });
            return callback(null, deduped);
          } catch (e) {
            return callback(null, rows);
          }
        }
        // Fall through to the general search below
        // (continue with building full SQL)
      });
    }

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
    
    if (process.env.NODE_ENV === 'development') {
      console.log('DEBUG Station.search SQL:', sql);
      console.log('DEBUG Station.search params:', params);
    }

    db.all(sql, params, (err, stations) => {
      if (err) return callback(err);

      // Use smarter de-duplication that picks a canonical station among duplicates
      // using query-aware scoring (prefers aliases, exact and acronym matches).
      try {
        // Score all stations to prefer alias/exact matches globally
        const scored = (stations || []).map(s => ({ s, score: Station._scoreStation(s, query) }));
        scored.sort((a, b) => b.score - a.score);

        // Then de-duplicate by normalized key, keeping highest-scoring item per group
        const seen = new Map();
        const unique = [];
        scored.forEach(({ s }) => {
          const key = `${(s.name||'').trim().toLowerCase()}|${(s.city||'').trim().toLowerCase()}|${(s.address||'').trim().toLowerCase()}`;
          if (!seen.has(key)) {
            seen.set(key, true);
            unique.push(s);
          }
        });

        return callback(null, unique);
      } catch (e) {
        // Fallback to simple dedupe if anything goes wrong
        const seen = new Map();
        const unique = [];
        (stations || []).forEach(s => {
          const key = `${(s.name||'').trim().toLowerCase()}|${(s.city||'').trim().toLowerCase()}|${(s.address||'').trim().toLowerCase()}`;
          if (!seen.has(key)) { seen.set(key, true); unique.push(s); }
        });
        return callback(null, unique);
      }
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
    
    db.all(sql, [type, `%${query}%`, `%${query}%`, limit], (err, stations) => {
      if (err) return callback(err);
      callback(null, Station._dedupeStations(stations));
    });
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
    db.all(sql, [universityId], (err, stations) => {
      if (err) return callback(err);
      callback(null, Station._dedupeStations(stations));
    });
  },

  // Obtenir toutes les stations d'une ville
  getByCity: (city, callback) => {
    const sql = `SELECT s.*, u.name as university_name
                 FROM stations s
                 LEFT JOIN universities u ON s.university_id = u.id
                 WHERE s.city LIKE ? AND s.is_active = 1
                 ORDER BY s.search_count DESC, s.name
                 LIMIT 50`;
    db.all(sql, [`%${city}%`], (err, stations) => {
      if (err) return callback(err);
      callback(null, Station._dedupeStations(stations));
    });
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
    db.all(sql, [limit], (err, stations) => {
      if (err) return callback(err);
      callback(null, Station._dedupeStations(stations));
    });
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