// server.js - VERSION COMPLÈTE CORRIGÉE
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const db = require('./config/db');

// Global error handlers to help debug DB statement errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error('Last SQL:', db._lastSql, 'Last params:', db._lastParams);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  console.error('Last SQL:', db._lastSql, 'Last params:', db._lastParams);
});

// IMPORTANT: Initialiser la base de données
require('./db/init');

// 1. CRÉER L'APP EXPRESS
const app = express();

// 🔧 CONFIGURATION CORS SIMPLE POUR LE DÉVELOPPEMENT
const corsOptions = {
  origin: '*', // Tout autoriser
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

// 2. MIDDLEWARES
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. ROUTE TEST - AJOUTE ICI (après les middlewares, avant les autres routes)
app.post('/api/test-simple', (req, res) => {
  console.log('📨 Test simple route hit!');
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  
  res.json({
    success: true,
    message: 'Test route works!',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// Import des routes
const authRoutes = require('./routes/auth.routes');
const stationRoutes = require('./routes/station.routes');
const rideRoutes = require('./routes/ride.routes');
const searchRoutes = require('./routes/search.routes');
const reservationRoutes = require('./routes/reservation.routes');
const reviewRoutes = require('./routes/review.routes');
const ratingRoutes = require('./routes/rating.routes');
const advancedRoutes = require('./routes/advanced.routes');
const statsRoutes = require('./routes/stats.routes');
const chatRoutes = require('./routes/chat.routes');

// 4. ROUTES API
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/advanced', advancedRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/chat', chatRoutes);

// Route pour vérifier que l'API fonctionne
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Moov API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'SQLite',
    port: 3000,
    cors: 'enabled'
  });
});
// Dans server.js, dans la section debug
app.get('/api/debug/codes', (req, res) => {
  db.all(`SELECT id, email, code, 
          strftime('%Y-%m-%d %H:%M:%S', expires_at) as expires_at,
          strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at
          FROM verification_codes 
          ORDER BY created_at DESC`, 
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        count: rows.length,
        codes: rows,
        now: new Date().toISOString()
      });
    });
});

// Documentation simple
app.get('/api', (req, res) => {
  res.json({
    service: 'Moov API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      stations: '/api/stations',
      rides: '/api/rides',
      search: '/api/search',
      reservations: '/api/reservations',
      reviews: '/api/reviews',
      advanced: '/api/advanced'
    },
    test_routes: {
      health: '/api/health',
      universities: '/api/auth/universities',
      popular_stations: '/api/stations/popular',
      login: '/api/auth/login (POST)',
      register: '/api/auth/register (POST)'
    }
  });
});

// Route de test simple
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API Moov fonctionnelle!',
    timestamp: new Date().toISOString(),
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      ip: req.ip
    }
  });
});

// Route pour tester les CORS
app.options('/api/test-cors', cors()); // Pré-flight pour CORS
app.get('/api/test-cors', (req, res) => {
  res.json({
    message: 'Test CORS réussi',
    origin: req.headers.origin || 'pas d\'origine',
    timestamp: new Date().toISOString(),
    cors: 'configuré pour toutes les origines'
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
      '/api/auth/register',
      '/api/test',
      '/api/test-cors'
    ]
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('🔥 Erreur serveur:', err.stack);
  
  // Gestion spécifique des erreurs CORS
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: err.message,
      hint: 'Vérifiez l\'origine de votre requête. En développement, toutes les origines sont autorisées.'
    });
  }
  
  const statusCode = err.status || 500;
  const message = err.message || 'Erreur serveur interne';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Port de configuration
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Vérifier que toutes les routes sont chargées
console.log('🔍 Routes chargées:');
console.log('- POST /api/test-simple'); // AJOUTE CETTE LIGNE
console.log('- GET  /api/health');
console.log('- GET  /api/test');
console.log('- GET  /api/test-cors');
console.log('- POST /api/auth/login');
console.log('- POST /api/auth/register');
console.log('- GET  /api/auth/universities');
console.log('- GET  /api/stations/popular');
console.log('- POST /api/rides'); // <-- AJOUTE
console.log('- GET  /api/rides/my-rides'); // <-- AJOUTE
console.log('- GET  /api/rides/search'); // <-- AJOUTE

// Démarrer le serveur
// Nettoyage périodique des codes de vérification expirés
const CLEANUP_INTERVAL_MS = process.env.CLEANUP_EXPIRED_CODES_INTERVAL_MS ? parseInt(process.env.CLEANUP_EXPIRED_CODES_INTERVAL_MS, 10) : 10 * 60 * 1000;
function cleanupExpiredVerificationCodes() {
  const sql = "DELETE FROM verification_codes WHERE expires_at <= datetime('now')";
  db.run(sql, function(err) {
    if (err) console.error('Erreur suppression codes expirés:', err.message);
    else if (this.changes && this.changes > 0) console.log(`✅ Codes expirés supprimés: ${this.changes}`);
  });
}
// Exécuter immédiatement au démarrage puis toutes les X minutes
cleanupExpiredVerificationCodes();
setInterval(cleanupExpiredVerificationCodes, CLEANUP_INTERVAL_MS);

const server = app.listen(PORT, HOST, () => {
  console.log('\n🚀 ==========================================');
  console.log('🚀 Serveur Moov API démarré avec succès!');
  console.log('🚀 ==========================================');
  console.log(`📡 URL: http://${HOST}:${PORT}`);
  console.log(`📡 URL alternative: http://localhost:${PORT}`);
  console.log(`🌐 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 CORS: Activé pour toutes les origines`);
  console.log(`📚 Documentation: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test simple: http://localhost:${PORT}/api/test`);
  console.log(`🎓 Universités: http://localhost:3000/api/auth/universities`);
  console.log(`🚗 Stations: http://localhost:3000/api/stations/popular`);
  console.log(`🧪 Test POST: http://localhost:3000/api/test-simple`);
  console.log('==========================================\n');
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du serveur (SIGTERM)...');
  server.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});