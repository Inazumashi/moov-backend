// Table users avec champ is_verified
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  is_verified BOOLEAN DEFAULT 0,  // ← CHAMP IMPORTANT POUR LA VÉRIFICATION
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) {
    console.error('❌ Erreur création table users:', err);
  } else {
    console.log('✅ Table "users" prête !');
  }
});