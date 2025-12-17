// models/transaction.model.js
const db = require('../config/db');

const Transaction = {
  // Enregistrer une nouvelle transaction (PayPal ou Carte)
  create: (data, callback) => {
    // On insère l'historique sans toucher à la table users
    const sql = `INSERT INTO transactions 
                 (user_id, amount, currency, payment_method, transaction_id, status, description, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    db.run(sql, [
      data.user_id, 
      data.amount, 
      data.currency, 
      data.payment_method, 
      data.transaction_id, 
      data.status, 
      data.description
    ], function(err) {
      if (err) return callback(err);
      callback(null, { id: this.lastID });
    });
  },

  // Vérifier si une transaction existe déjà (pour éviter les doublons)
  findByTransactionId: (transactionId, callback) => {
    const sql = 'SELECT id FROM transactions WHERE transaction_id = ?';
    db.get(sql, [transactionId], callback);
  }
};

module.exports = Transaction;