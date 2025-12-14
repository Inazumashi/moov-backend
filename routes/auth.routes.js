// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const User = require('../models/user.model');

// Public routes
router.post('/check-email', authController.checkUniversityEmail);
router.post('/check-email-exists', authController.checkEmailExists);
router.post('/verify-code', authController.verifyEmailCode);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/resend-code', authController.resendVerificationCode);
router.get('/universities', authController.getUniversities);

// Protected routes 
router.get('/profile', authMiddleware, (req, res) => {
  // req.userId est disponible via le middleware
  User.findById(req.userId, (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    res.json({ success: true, user });
  });
});
// File: routes/auth.routes.js - AJOUTEZ CETTE ROUTE
// Route pour valider le token
router.get('/validate-token', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Token valide',
    userId: req.userId
  });
});

// ... autres routes existantes
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;