const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import de la base de données
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORRECTION CORS - Configuration complète
app.use(cors({
  origin: '*', // Autorise toutes les origines pour le test
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

// Middleware pour les préflight OPTIONS
app.options('*', cors());

app.use(express.json());

// Routes d'authentification
app.use('/api/auth', require('./routes/auth.routes'));

// ✅ ROUTES ESSENTIELLES - Version simplifiée et robuste

// Route de santé
app.get('/api/health', (req, res) => {
  console.log('✅ Health check appelé');
  res.json({ 
    success: true,
    message: '🚀 API MovApp fonctionnelle!',
    timestamp: new Date().toISOString()
  });
});

// Route pour les universités
app.get('/api/universities', (req, res) => {
  console.log('✅ Universities appelé');
  db.all('SELECT * FROM universities', (err, rows) => {
    if (err) {
      console.error('❌ Erreur universités:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    console.log(`✅ ${rows.length} universités retournées`);
    res.json({ universities: rows });
  });
});

// Route pour les favoris
app.get('/api/rides/favorites', (req, res) => {
  console.log('✅ Favorites appelé');
  // Pour l'instant, retourne un tableau vide
  res.json({ favorites: [] });
});

// Route pour la recherche
app.get('/api/rides/search', (req, res) => {
  console.log('✅ Search appelé avec params:', req.query);
  
  const demoRides = [
    {
      id: 1,
      driver_id: 1,
      first_name: 'Karim',
      last_name: 'El Idrissi',
      departure_address: 'Ben Guerir',
      destination_address: 'Casablanca', 
      departure_date: new Date().toISOString(),
      available_seats: 4,
      price_per_seat: 70.0,
      car_model: 'Renault Clio',
      car_color: 'Bleu',
      description: 'Trajet confortable',
      rating: 4.7
    },
    {
      id: 2, 
      driver_id: 2,
      first_name: 'Amina',
      last_name: 'Laaroussi',
      departure_address: 'UM6P Campus',
      destination_address: 'Marrakech',
      departure_date: new Date(Date.now() + 86400000).toISOString(), // Demain
      available_seats: 2,
      price_per_seat: 45.0,
      car_model: 'Peugeot 208',
      car_color: 'Rouge',
      description: 'Trajet rapide',
      rating: 4.9
    }
  ];
  
  res.json({ rides: demoRides });
});

// Route pour mes trajets publiés
app.get('/api/rides/my-published', (req, res) => {
  console.log('✅ My published rides appelé');
  res.json({ rides: [] });
});

// Route de test globale
app.get('/', (req, res) => {
  console.log('✅ Root appelé');
  res.json({ 
    success: true,
    message: '🚀 API MovApp fonctionnelle!',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      universities: 'GET /api/universities',
      favorites: 'GET /api/rides/favorites', 
      search: 'GET /api/rides/search',
      my_rides: 'GET /api/rides/my-published'
    }
  });
});

// ✅ DÉMARRAGE SUR TOUTES LES INTERFACES
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Réseau: http://[votre-ip]:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
});
// Après la création des tables dans db.js, ajoutez :
db.run(`INSERT OR IGNORE INTO users (email, password, first_name, last_name, phone, is_verified) 
        VALUES ('test@example.com', 'password', 'Test', 'User', '+212600000000', 1)`);