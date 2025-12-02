// models/user.model.js
const db = require('../config/db');

const User = {
  // Trouver par email
  findByEmail: (email, callback) => {
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.get(sql, [email], callback);
  },

  // Trouver par ID
  findById: (id, callback) => {
    const sql = 'SELECT id, email, first_name, last_name, phone, university, profile_type, is_verified, rating, total_trips FROM users WHERE id = ?';
    db.get(sql, [id], callback);
  },

  // Créer utilisateur
  create: (userData, callback) => {
    const { email, password, first_name, last_name, phone, university, profile_type, student_id } = userData;
    const sql = `INSERT INTO users 
                 (email, password, first_name, last_name, phone, university, profile_type, student_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [email, password, first_name, last_name, phone, university, profile_type, student_id], 
      function(err) {
        callback(err, { id: this.lastID, email, first_name, last_name });
      }
    );
  },

  // Vérifier utilisateur par email
  verifyUserByEmail: (email, callback) => {
    const sql = 'UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE email = ?';
    db.run(sql, [email], callback);
  },

  // Mettre à jour le profil
  updateProfile: (id, userData, callback) => {
    const { first_name, last_name, phone, is_driver, has_car, car_model, car_seats } = userData;
    const sql = `UPDATE users 
                 SET first_name = ?, last_name = ?, phone = ?, 
                     is_driver = ?, has_car = ?, car_model = ?, car_seats = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    
    db.run(sql, [first_name, last_name, phone, is_driver, has_car, car_model, car_seats, id], callback);
  },

  // Sauvegarder code de vérification
  saveVerificationCode: (email, code, expiresAt, callback) => {
    const sql = `INSERT INTO verification_codes (email, code, expires_at) 
                 VALUES (?, ?, ?)`;
    db.run(sql, [email, code, expiresAt], callback);
  },

  // Vérifier code
  verifyCode: (email, code, callback) => {
    const sql = `SELECT * FROM verification_codes 
                 WHERE email = ? AND code = ? AND expires_at > datetime('now') 
                 ORDER BY created_at DESC LIMIT 1`;
    db.get(sql, [email, code], callback);
  },

  // Supprimer code utilisé
  deleteVerificationCode: (id, callback) => {
    const sql = 'DELETE FROM verification_codes WHERE id = ?';
    db.run(sql, [id], callback);
  },

  // Récupérer toutes les universités
  getAllUniversities: (callback) => {
    const sql = 'SELECT * FROM universities WHERE is_active = 1 ORDER BY name';
    db.all(sql, callback);
  },

  // Vérifier si l'email est d'une université valide
  isValidUniversityEmail: (email, callback) => {
    const sql = `SELECT * FROM universities 
                 WHERE ? LIKE '%' || domain 
                 AND is_active = 1`;
    db.get(sql, [email], (err, university) => {
      if (err) return callback(err, null);
      callback(null, !!university);
    });
  },

  // Trouver l'université par email
  findUniversityByEmail: (email, callback) => {
    const sql = `SELECT * FROM universities 
                 WHERE ? LIKE '%' || domain 
                 AND is_active = 1`;
    db.get(sql, [email], callback);
  },
  // Dans models/user.model.js, ajoute si manquant :
getAllUniversities: (callback) => {
  const sql = 'SELECT * FROM universities WHERE is_active = 1 ORDER BY name';
  db.all(sql, callback);
},
};

module.exports = User;