const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin vers la base de données
const dbPath = path.join(__dirname, '..', 'movapp.db');

// Connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données:', err.message);
  } else {
    console.log('✅ Connecté à la base de données SQLite.');
    
    // Création des tables
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      is_verified BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('❌ Erreur création table users:', err);
      } else {
        console.log('✅ Table "users" prête !');
      }
    });

    // Ajoutez d'autres tables ici au besoin
    db.run(`CREATE TABLE IF NOT EXISTS universities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      student_count INTEGER,
      domain TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER,
      departure_address TEXT NOT NULL,
      destination_address TEXT NOT NULL,
      departure_date DATETIME NOT NULL,
      available_seats INTEGER NOT NULL,
      price_per_seat REAL NOT NULL,
      car_model TEXT,
      car_color TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insérer des données de test pour les universités
    db.run(`INSERT OR IGNORE INTO universities (name, student_count, domain) VALUES 
      ('UM6P - Université Mohammed VI Polytechnique', 5000, 'um6p.ma'),
      ('Université Cadi Ayyad', 15000, 'uca.ma'),
      ('Université Hassan II', 20000, 'uh2c.ma')
    `);
  }
});

// ✅ EXTRÊMEMENT IMPORTANT : Exporter la connexion db
module.exports = db;