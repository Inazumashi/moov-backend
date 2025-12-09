// server.js - MODIFIEZ LE PORT À 3000
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

// IMPORTANT: Initialiser la base de données
require('./db/init');

const app = express();

// 🔧 CONFIGURATION CORS POUR FLUTTER - MISE À JOUR
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile / postman

    // Autoriser tout ce qui vient de localhost, quel que soit le port
    if (origin.startsWith("http://localhost")) {
      return callback(null, true);
    }

    // Autoriser aussi pour l'émulateur Android
    if (origin.startsWith("http://10.0.2.2")) {
      return callback(null, true);
    }

    callback(new Error("CORS not allowed for this origin: " + origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept','Origin','X-Requested-With']
};


// Middleware
app.use(cors(corsOptions));
app.use(cors({ origin: '*' }));
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
    environment: process.env.NODE_ENV || 'development',
    database: 'SQLite',
    port: 3000
  });
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    requestedUrl: req.originalUrl,
    available_routes: [
      '/api/health',
      '/api/auth/universities',
      '/api/stations/popular',
      '/api/auth/login',
      '/api/auth/register'
    ]
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

// Port configuration - CHANGÉ À 3000
const PORT = process.env.PORT || 3000; // ← PORT 3000
const HOST = process.env.HOST || 'localhost';

// Démarrer le serveur
app.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur Moov API démarré`);
  console.log(`📡 URL: http://${HOST}:${PORT}`);
  console.log(`🌐 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 CORS activé pour Flutter/Expo`);
  console.log(`📚 Documentation: http://${HOST}:${PORT}/api`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/api/health`);
  console.log(`🎓 Universités: http://${HOST}:${PORT}/api/auth/universities`);
});