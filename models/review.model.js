const db = require('../config/db');

const Review = {
  // Ajouter une note après un trajet
  create: (reviewData, callback) => {
    const { ride_id, reviewer_id, reviewed_id, role_reviewed, rating, comment } = reviewData;
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // 1. Créer la review
      db.run(`INSERT INTO reviews (ride_id, reviewer_id, reviewed_id, role_reviewed, rating, comment) 
              VALUES (?, ?, ?, ?, ?, ?)`, 
        [ride_id, reviewer_id, reviewed_id, role_reviewed, rating, comment], 
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return callback(err);
          }
          
          const reviewId = this.lastID;
          
          // 2. Mettre à jour la note moyenne de l'utilisateur
          const updateRatingSql = `
            UPDATE users 
            SET rating = (
              SELECT AVG(rating) 
              FROM reviews 
              WHERE reviewed_id = ? 
              AND role_reviewed = ?
            ),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`;
          
          db.run(updateRatingSql, [reviewed_id, role_reviewed, reviewed_id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return callback(err);
            }
            
            // 3. Vérifier et attribuer des badges
            Review.checkAndAwardBadges(reviewed_id, (badgeErr) => {
              if (badgeErr) console.error('Erreur attribution badges:', badgeErr);
              
              db.run('COMMIT');
              callback(null, { id: reviewId });
            });
          });
        }
      );
    });
  },

  // Obtenir les notes d'un utilisateur
  getUserReviews: (userId, role = null, limit = 20, callback) => {
    let sql = `SELECT r.*,
                      reviewer.first_name as reviewer_first_name,
                      reviewer.last_name as reviewer_last_name,
                      ride.departure_station_id,
                      ride.arrival_station_id,
                      ds.name as departure_station,
                      as.name as arrival_station
               FROM reviews r
               JOIN users reviewer ON r.reviewer_id = reviewer.id
               JOIN rides ride ON r.ride_id = ride.id
               JOIN stations ds ON ride.departure_station_id = ds.id
               JOIN stations as ON ride.arrival_station_id = as.id
               WHERE r.reviewed_id = ?`;
    
    const params = [userId];
    
    if (role) {
      sql += ` AND r.role_reviewed = ?`;
      params.push(role);
    }
    
    sql += ` ORDER BY r.created_at DESC LIMIT ?`;
    params.push(limit);
    
    db.all(sql, params, callback);
  },

  // Vérifier si un utilisateur peut noter
  canReview: (rideId, reviewerId, reviewedId, callback) => {
    // Vérifier si le trajet est terminé et si les utilisateurs y ont participé
    const sql = `
      SELECT 
        CASE 
          WHEN r.driver_id = ? THEN 'driver'
          WHEN EXISTS (
            SELECT 1 FROM bookings b 
            WHERE b.ride_id = r.id 
            AND b.passenger_id = ? 
            AND b.status IN ('completed', 'confirmed')
          ) THEN 'passenger'
          ELSE 'none'
        END as user_role,
        r.status as ride_status
      FROM rides r
      WHERE r.id = ?`;
    
    db.get(sql, [reviewerId, reviewerId, rideId], (err, result) => {
      if (err) return callback(err);
      
      if (!result || result.user_role === 'none' || result.ride_status !== 'completed') {
        return callback(null, { canReview: false, reason: 'Trajet non terminé ou non participé' });
      }
      
      // Vérifier si l'utilisateur a déjà noté
      const checkSql = `SELECT id FROM reviews WHERE ride_id = ? AND reviewer_id = ? AND reviewed_id = ?`;
      db.get(checkSql, [rideId, reviewerId, reviewedId], (err, existingReview) => {
        callback(err, { 
          canReview: !existingReview,
          userRole: result.user_role 
        });
      });
    });
  },

  // Statistiques des notes
  getUserStats: (userId, callback) => {
    const sql = `
      SELECT 
        role_reviewed,
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_stars
      FROM reviews
      WHERE reviewed_id = ?
      GROUP BY role_reviewed`;
    
    db.all(sql, [userId], (err, stats) => {
      if (err) return callback(err);
      
      const driverStats = stats.find(s => s.role_reviewed === 'driver') || {
        total_reviews: 0,
        average_rating: 5.0
      };
      
      const passengerStats = stats.find(s => s.role_reviewed === 'passenger') || {
        total_reviews: 0,
        average_rating: 5.0
      };
      
      callback(null, { driverStats, passengerStats });
    });
  },

  // Vérifier et attribuer des badges
  checkAndAwardBadges: (userId, callback) => {
    // Badge "Perfect Rating" (note moyenne > 4.8)
    const perfectRatingSql = `
      INSERT OR IGNORE INTO user_badges (user_id, badge_type)
      SELECT ?, 'perfect_rating'
      FROM reviews 
      WHERE reviewed_id = ?
      HAVING AVG(rating) >= 4.8`;
    
    db.run(perfectRatingSql, [userId, userId], (err) => {
      if (err) console.error('Erreur attribution badge perfect_rating:', err);
    });
    
    // Badge "Top Driver" (plus de 10 trajets en tant que conducteur)
    const topDriverSql = `
      INSERT OR IGNORE INTO user_badges (user_id, badge_type)
      SELECT ?, 'top_driver'
      FROM rides 
      WHERE driver_id = ? 
      AND status = 'completed'
      HAVING COUNT(*) >= 10`;
    
    db.run(topDriverSql, [userId, userId], (err) => {
      if (err) console.error('Erreur attribution badge top_driver:', err);
    });
    
    // Badge "Frequent Traveler" (plus de 20 réservations)
    const frequentTravelerSql = `
      INSERT OR IGNORE INTO user_badges (user_id, badge_type)
      SELECT ?, 'frequent_traveler'
      FROM bookings 
      WHERE passenger_id = ? 
      AND status IN ('completed', 'confirmed')
      HAVING COUNT(*) >= 20`;
    
    db.run(frequentTravelerSql, [userId, userId], (err) => {
      if (err) console.error('Erreur attribution badge frequent_traveler:', err);
    });
    
    callback();
  },

  // Obtenir les badges d'un utilisateur
  getUserBadges: (userId, callback) => {
    const sql = `SELECT badge_type, earned_at FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC`;
    db.all(sql, [userId], callback);
  }
};

module.exports = Review;