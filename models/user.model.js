// models/user.model.js
const db = require('../config/db');

const User = {
  // Trouver par email (utilisé pour login — récupère le mot de passe)
  findByEmail: (email, callback) => {
    // Match
    //  emails case-insensitively using LOWER() for portability
    const sql = 'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1';
    db.get(sql, [email], callback);
  },

  // Trouver par ID (retourne les colonnes publiques)
  findById: (id, callback) => {
    const sql = `SELECT id, email, first_name, last_name, phone, university, profile_type, is_verified, rating, total_trips, is_driver, has_car, car_model, car_seats, premium_status, created_at, updated_at
                 FROM users WHERE id = ?`;
    db.get(sql, [id], callback);
  },

  // Créer utilisateur et retourner l'enregistrement complet
  create: (userData, callback) => {
    const { email, password, first_name, last_name, phone, university, profile_type, student_id } = userData;
    const sql = `INSERT INTO users 
                 (email, password, first_name, last_name, phone, university, profile_type, student_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [email, password, first_name, last_name, phone, university, profile_type, student_id], function(err) {
      if (err) return callback(err);
      const newId = this.lastID;
      // Récupérer l'utilisateur créé avec toutes ses colonnes publiques
      const selectSql = `SELECT id, email, first_name, last_name, phone, university, profile_type, student_id, is_verified, rating, total_trips, created_at, updated_at FROM users WHERE id = ?`;
      db.get(selectSql, [newId], (err, row) => {
        callback(err, row);
      });
    });
  },

  // Vérifier utilisateur par email (marquer comme vérifié)
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

  // Sauvegarder code de vérification (accepte Date, timestamp ou ISO string)
  saveVerificationCode: (email, code, expiresAt, callback) => {
    let expiresAtFormatted = expiresAt;
    if (typeof expiresAt === 'number') {
      expiresAtFormatted = new Date(expiresAt).toISOString();
    } else if (expiresAt instanceof Date) {
      expiresAtFormatted = expiresAt.toISOString();
    }

    const sql = `INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)`;
    db.run(sql, [email, code, expiresAtFormatted], callback);
  },

  // Vérifier un code de vérification valide
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
    // Use LOWER(?) LIKE '%' || LOWER(domain) to allow subdomains and case-insensitive match
    const sql = `SELECT * FROM universities WHERE LOWER(?) LIKE '%' || LOWER(domain) AND is_active = 1`;
    db.get(sql, [email], (err, university) => {
      if (err) return callback(err, null);
      callback(null, !!university);
    });
  },

  // Trouver l'université par email
  findUniversityByEmail: (email, callback) => {
    const sql = `SELECT * FROM universities WHERE LOWER(?) LIKE '%' || LOWER(domain) AND is_active = 1`;
    db.get(sql, [email], callback);
  },
  // Activer le mode premium
  activatePremium: (userId, callback) => {
    // Met à jour le status premium à 1 (True)
    // Assure-toi que ta base de données a bien la colonne 'premium_status'
    const sql = `UPDATE users SET premium_status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [userId], callback);
  }
};

module.exports = User;