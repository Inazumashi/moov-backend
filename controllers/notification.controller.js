const Notification = require('../models/notification.model');

const notificationController = {
    // Get all notifications for current user
    getMyNotifications: (req, res) => {
        const userId = req.userId;
        Notification.findByUser(userId, (err, notifications) => {
            if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });

            // Calculate unread count
            const unreadCount = notifications.filter(n => !n.is_read).length;

            res.json({ success: true, notifications, unreadCount });
        });
    },

    // Mark one notification as read
    markAsRead: (req, res) => {
        const userId = req.userId;
        const { id } = req.params;

        Notification.markAsRead(id, userId, (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
            res.json({ success: true, message: 'Marqué comme lu' });
        });
    },

    // Mark all as read
    markAllAsRead: (req, res) => {
        const userId = req.userId;
        Notification.markAllAsRead(userId, (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
            res.json({ success: true, message: 'Tout marqué comme lu' });
        });
    },

    // Get unread count only
    getUnreadCount: (req, res) => {
        const userId = req.userId;
        Notification.countUnread(userId, (err, result) => {
            if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
            res.json({ success: true, count: result ? result.count : 0 });
        });
    },

    // Delete notification
    deleteNotification: (req, res) => {
        const userId = req.userId;
        const { id } = req.params;

        // Vérifier appartenance (optionnel mais recommandé, nécessiterait un findOne d'abord ou un DELETE avec clause WHERE user_id)
        const sql = 'DELETE FROM notifications WHERE id = ? AND user_id = ?';
        const db = require('../config/db'); // Need db access directly

        db.run(sql, [id, userId], function (err) {
            if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
            if (this.changes === 0) return res.status(404).json({ success: false, message: 'Notification non trouvée' });

            res.json({ success: true, message: 'Notification supprimée' });
        });
    }
};

module.exports = notificationController;

