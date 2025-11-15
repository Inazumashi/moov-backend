//Définit les URL pour l'inscription et la connexion (ex: /api/v1/auth/login).
const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login  
router.post('/login', authController.login);

module.exports = router;