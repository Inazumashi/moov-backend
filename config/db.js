// config/db.js

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./moov.db', (err) => {
  if (err) {
    console.error("❌ Erreur connexion SQLite :", err.message);
  } else {
    console.log("✅ Base SQLite connectée : moov.db");
  }
});

module.exports = db;
