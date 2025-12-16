const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../config/db');

router.use(authMiddleware);

// Routes principales
router.post('/', reservationController.create);
router.delete('/:id', reservationController.cancel);
router.patch('/:id/complete', reservationController.complete);
router.put('/:id/complete', reservationController.complete);
router.get('/my-reservations', reservationController.myReservations);
// Alias court pour compatibilité client
router.get('/my', reservationController.myReservations);
router.get('/ride/:rideId', reservationController.rideReservations);
// Alias attendu par le client Flutter
router.get('/for-ride/:rideId', reservationController.rideReservations);

// Statistiques (pour l'écran d'accueil)
router.get('/stats', (req, res) => {
  const userId = req.userId;
  
  const sql = `SELECT 
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as upcoming_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
               FROM bookings 
               WHERE passenger_id = ?`;
  
  db.all(sql, [userId], (err, stats) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
    
    res.json({
      success: true,
      stats: stats[0] || {}
    });
  });
});

module.exports = router;