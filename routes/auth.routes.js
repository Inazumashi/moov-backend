// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes
router.post('/check-email', authController.checkUniversityEmail);
router.post('/verify-code', authController.verifyEmailCode);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/resend-code', authController.resendVerificationCode);
router.get('/universities', authController.getUniversities);

// Protected routes 
router.get('/profile', authMiddleware, (req, res) => {
  // req.userId est disponible via le middleware
  User.findById(req.userId, (err, user) => {
    if (err || !user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    res.json({
      success: true,
      user
    });
  });
});

router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;