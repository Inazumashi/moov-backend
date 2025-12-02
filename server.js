require('./db/init'); // crée les tables automatiquement
// server.js - VERSION COMPLÈTE POUR FLUTTER
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import des routes
const authRoutes = require('./routes/auth.routes');
const stationRoutes = require('./routes/station.routes');
const rideRoutes = require('./routes/ride.routes');
const searchRoutes = require('./routes/search.routes');
const reservationRoutes = require('./routes/reservation.routes');
const reviewRoutes = require('./routes/review.routes');
const advancedRoutes = require('./routes/advanced.routes');

const app = express();

// 🔧 CONFIGURATION CORS POUR FLUTTER
const corsOptions = {
  origin: [
    'http://localhost',          // Web
    'http://localhost:3000',     // React dev
    'http://localhost:5000',     // Node dev
    'http://localhost:5001',     // <--- AJOUTÉ
    'http://10.0.2.2:5000',     // Android Emulator
    'http://10.0.2.2:5001',      // <--- AJOUTÉ
    'http://10.0.2.2',          // Android Emulator alternative
    'exp://localhost:19000',     // Expo
    'exp://192.168.1.*:19000',  // Expo sur réseau
    'http://localhost:19006',    // Expo web
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/advanced', advancedRoutes);

// Route pour vérifier que l'API fonctionne
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Moov API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Documentation API (optionnel)
app.get('/api', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API Moov',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        verify: 'POST /api/auth/verify-email',
        profile: 'GET /api/auth/profile (protected)'
      },
      stations: {
        autocomplete: 'GET /api/stations/autocomplete?q=nom',
        nearby: 'GET /api/stations/nearby?lat=xx&lng=yy',
        favorites: 'GET /api/stations/favorites (protected)'
      },
      rides: {
        create: 'POST /api/rides (protected)',
        search: 'GET /api/rides/search?from=X&to=Y&date=...',
        myRides: 'GET /api/rides/my-rides (protected)'
      }
    }
  });
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    requestedUrl: req.originalUrl
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('🔥 Erreur serveur:', err.stack);
  
  const statusCode = err.status || 500;
  const message = err.message || 'Erreur serveur interne';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Port configuration
const PORT = process.env.PORT || 5001; // <--- PORT PAR DÉFAUT MODIFIÉ À 5001
const HOST = process.env.HOST || '0.0.0.0';

// Démarrer le serveur
app.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur Moov API démarré`);
  console.log(`📡 URL: http://${HOST}:${PORT}`);
  console.log(`🌐 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 CORS activé pour Flutter/Expo`);
  console.log(`📚 Documentation: http://${HOST}:${PORT}/api`);
});