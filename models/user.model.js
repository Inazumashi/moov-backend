const db = require('../config/db');

const User = {
  // Trouver un utilisateur par email
  findByEmail: (email, callback) => {
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.get(sql, [email], callback);
  },

  // Créer un nouvel utilisateur
  create: (userData, callback) => {
    const { email, password, first_name, last_name, phone } = userData;
    const sql = `INSERT INTO users (email, password, first_name, last_name, phone) 
                 VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [email, password, first_name, last_name, phone], function(err) {
      callback(err, { id: this.lastID });
    });
  },

  // Mettre à jour le statut premium (optionnel pour plus tard)
  upgradeToPremium: (id, callback) => {
    const sql = `UPDATE users SET premium_status = 'active' WHERE id = ?`;
    db.run(sql, [id], callback);
  },

  // --- AJOUTEZ CETTE FONCTION MANQUANTE ---
  // Vérifier un utilisateur par email
  verifyUserByEmail: (email, callback) => {
    const sql = 'UPDATE users SET is_verified = 1 WHERE email = ?';
    db.run(sql, [email], callback);
  }
};

module.exports = User;