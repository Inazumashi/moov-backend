const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import de la base de données
require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes d'authentification
app.use('/api/auth', require('./routes/auth.routes'));

// Route de test
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: '🚀 API MovApp fonctionnelle!',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré: http://localhost:${PORT}`);
});