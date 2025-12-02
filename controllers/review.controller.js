const Review = require('../models/review.model');

const reviewController = {
  // Ajouter une note
  createReview: async (req, res) => {
    try {
      const reviewerId = req.userId;
      const { ride_id, reviewed_id, rating, comment } = req.body;

      // Validation
      if (!ride_id || !reviewed_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides. La note doit être entre 1 et 5.'
        });
      }

      // Vérifier si l'utilisateur peut noter
      Review.canReview(ride_id, reviewerId, reviewed_id, (err, result) => {
        if (err) {
          console.error('Erreur vérification permission:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        if (!result.canReview) {
          return res.status(403).json({
            success: false,
            message: result.reason || 'Vous ne pouvez pas noter ce trajet'
          });
        }

        // Déterminer le rôle (conducteur ou passager)
        const role_reviewed = reviewerId === reviewed_id ? 'same_user' : 
          (result.userRole === 'driver' ? 'passenger' : 'driver');

        if (role_reviewed === 'same_user') {
          return res.status(400).json({
            success: false,
            message: 'Vous ne pouvez pas vous noter vous-même'
          });
        }

        // Créer la review
        Review.create({
          ride_id,
          reviewer_id: reviewerId,
          reviewed_id,
          role_reviewed,
          rating,
          comment: comment || null
        }, (err, newReview) => {
          if (err) {
            console.error('Erreur création review:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la notation'
            });
          }

          res.status(201).json({
            success: true,
            message: 'Note ajoutée avec succès',
            review: { id: newReview.id, rating, comment }
          });
        });
      });
    } catch (error) {
      console.error('Erreur création review:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Mes notes reçues
  myReviews: async (req, res) => {
    try {
      const userId = req.userId;
      const { role, limit = 20 } = req.query;

      // Obtenir les statistiques
      Review.getUserStats(userId, (err, stats) => {
        if (err) {
          console.error('Erreur récupération stats:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        // Obtenir les reviews
        Review.getUserReviews(userId, role, parseInt(limit), (err, reviews) => {
          if (err) {
            console.error('Erreur récupération reviews:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur serveur'
            });
          }

          // Obtenir les badges
          Review.getUserBadges(userId, (err, badges) => {
            if (err) {
              console.error('Erreur récupération badges:', err);
              // On continue sans badges
            }

            res.json({
              success: true,
              stats,
              reviews,
              badges: badges || [],
              count: reviews.length
            });
          });
        });
      });
    } catch (error) {
      console.error('Erreur mes reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Noter après un trajet spécifique
  reviewAfterRide: async (req, res) => {
    try {
      const userId = req.userId;
      const { rideId } = req.params;
      const { ratings } = req.body; // Array d'objets {userId, rating, comment}

      if (!ratings || !Array.isArray(ratings)) {
        return res.status(400).json({
          success: false,
          message: 'Données de notation invalides'
        });
      }

      const results = [];
      let errors = [];

      // Pour chaque notation
      for (const rating of ratings) {
        try {
          await new Promise((resolve, reject) => {
            Review.canReview(rideId, userId, rating.userId, (err, result) => {
              if (err || !result.canReview) {
                errors.push(`Impossible de noter l'utilisateur ${rating.userId}: ${result?.reason || 'Erreur'}`);
                return resolve();
              }

              const role_reviewed = userId === rating.userId ? 'same_user' : 
                (result.userRole === 'driver' ? 'passenger' : 'driver');

              if (role_reviewed === 'same_user') {
                errors.push(`Impossible de se noter soi-même`);
                return resolve();
              }

              Review.create({
                ride_id: rideId,
                reviewer_id: userId,
                reviewed_id: rating.userId,
                role_reviewed,
                rating: rating.rating,
                comment: rating.comment || null
              }, (err, newReview) => {
                if (err) {
                  errors.push(`Erreur notation ${rating.userId}`);
                  resolve();
                } else {
                  results.push({
                    userId: rating.userId,
                    reviewId: newReview.id
                  });
                  resolve();
                }
              });
            });
          });
        } catch (error) {
          errors.push(`Erreur interne pour ${rating.userId}`);
        }
      }

      res.json({
        success: true,
        message: 'Notation(s) terminée(s)',
        results,
        errors: errors.length > 0 ? errors : null
      });
    } catch (error) {
      console.error('Erreur notation après trajet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Vérifier les trajets à noter
  getRidesToReview: async (req, res) => {
    try {
      const userId = req.userId;

      const sql = `
        SELECT r.id as ride_id, r.departure_date, r.arrival_date,
               ds.name as departure_station, as.name as arrival_station,
               u.id as other_user_id, u.first_name, u.last_name,
               CASE 
                 WHEN r.driver_id = ? THEN 'passenger'
                 ELSE 'driver'
               END as role_to_review
        FROM rides r
        JOIN stations ds ON r.departure_station_id = ds.id
        JOIN stations as ON r.arrival_station_id = as.id
        LEFT JOIN users u ON (r.driver_id = u.id OR u.id IN (
          SELECT passenger_id FROM bookings b 
          WHERE b.ride_id = r.id AND b.passenger_id != ?
        ))
        WHERE r.status = 'completed'
        AND r.id IN (
          -- Trajets où l'utilisateur est conducteur
          SELECT id FROM rides WHERE driver_id = ?
          UNION
          -- Trajets où l'utilisateur est passager
          SELECT ride_id FROM bookings WHERE passenger_id = ? AND status = 'completed'
        )
        AND NOT EXISTS (
          SELECT 1 FROM reviews rev 
          WHERE rev.ride_id = r.id 
          AND rev.reviewer_id = ? 
          AND rev.reviewed_id = u.id
        )
        AND u.id != ?
        ORDER BY r.departure_date DESC
        LIMIT 10`;

      db.all(sql, [userId, userId, userId, userId, userId, userId], (err, rides) => {
        if (err) {
          console.error('Erreur récupération trajets à noter:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        res.json({
          success: true,
          rides_to_review: rides,
          count: rides.length
        });
      });
    } catch (error) {
      console.error('Erreur trajets à noter:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
};

module.exports = reviewController;