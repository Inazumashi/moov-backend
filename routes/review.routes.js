const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Notation
router.post('/', reviewController.createReview);
router.post('/ride/:rideId', reviewController.reviewAfterRide);

// Consultation
router.get('/my-reviews', reviewController.myReviews);
router.get('/rides-to-review', reviewController.getRidesToReview);

// Badges
router.get('/badges', (req, res) => {
  const userId = req.userId;
  
  const sql = `SELECT badge_type, earned_at FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC`;
  db.all(sql, [userId], (err, badges) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
    
    res.json({
      success: true,
      badges
    });
  });
});

module.exports = router;