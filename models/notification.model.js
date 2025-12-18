const db = require('../config/db');

const Notification = {
    // Créer une notification
    create: (data, callback) => {
        const { user_id, title, message, type, related_entity_type, related_entity_id } = data;
        const sql = `INSERT INTO notifications 
                 (user_id, title, message, type, related_entity_type, related_entity_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(sql, [user_id, title, message, type, related_entity_type, related_entity_id], function (err) {
            if (err) return callback(err);
            callback(null, { id: this.lastID, ...data });
        });
    },

    // Récupérer les notifications d'un utilisateur
    findByUser: (userId, callback) => {
        const sql = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`;
        db.all(sql, [userId], callback);
    },

    // Marquer comme lue
    markAsRead: (id, userId, callback) => {
        const sql = `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`;
        db.run(sql, [id, userId], callback);
    },

    // Tout marquer comme lu
    markAllAsRead: (userId, callback) => {
        const sql = `UPDATE notifications SET is_read = 1 WHERE user_id = ?`;
        db.run(sql, [userId], callback);
    },

    // Compter les non lues
    countUnread: (userId, callback) => {
        const sql = `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`;
        db.get(sql, [userId], callback);
    }
};

module.exports = Notification;
