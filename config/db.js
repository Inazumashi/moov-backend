//Gère la connexion entre le serveur Node.js et la base de données PostgreSQL. Il définit aussi les tables SQL (users, rides, etc.)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(process.env.DB_PATH || './movapp.db');
const db = new sqlite3.Database(dbPath);

console.log('📦 Connexion à la base de données...');

// Création de la table users
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

)`, (err) => {
  if (err) {
    console.error('❌ Erreur création table users:', err);
  } else {
    console.log('✅ Table "users" prête et cree !');
  }
});

module.exports = db;