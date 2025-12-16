const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../config/db');

router.use(authMiddleware);

// Créer ou obtenir une conversation
router.post('/conversations', (req, res) => {
  const userId = req.userId;
  const { rideId } = req.body;
  if (!rideId) return res.status(400).json({ success: false, message: 'ID du trajet requis' });

  const rideSql = 'SELECT driver_id FROM rides WHERE id = ?';
  db.get(rideSql, [rideId], (err, ride) => {
    if (err || !ride) return res.status(404).json({ success: false, message: 'Trajet non trouvé' });
    const driverId = ride.driver_id;
    const passengerId = userId === driverId ? null : userId;
    if (!passengerId) return res.status(400).json({ success: false, message: 'Vous ne pouvez pas créer une conversation avec vous-même' });

    const checkSql = `
      SELECT c.*,
             d.first_name as driver_first_name,
             d.last_name as driver_last_name,
             p.first_name as passenger_first_name,
             p.last_name as passenger_last_name,
             r.departure_station_id,
             r.arrival_station_id,
             ds.name as departure_station,
             ars.name as arrival_station
      FROM conversations c
      JOIN users d ON c.driver_id = d.id
      JOIN users p ON c.passenger_id = p.id
      JOIN rides r ON c.ride_id = r.id
      JOIN stations ds ON r.departure_station_id = ds.id
      JOIN stations ars ON r.arrival_station_id = ars.id
      WHERE c.ride_id = ? AND c.passenger_id = ?
    `;

    db.get(checkSql, [rideId, passengerId], (err, existingConv) => {
      if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
      if (existingConv) return res.json({ success: true, conversation: existingConv, is_new: false });

      const insertSql = `INSERT INTO conversations (ride_id, passenger_id, driver_id) VALUES (?, ?, ?)`;
      db.run(insertSql, [rideId, passengerId, driverId], function(err) {
        if (err) return res.status(500).json({ success: false, message: 'Erreur création conversation' });
        db.get(checkSql, [rideId, passengerId], (err, newConv) => {
          if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
          res.status(201).json({ success: true, conversation: newConv, is_new: true });
        });
      });
    });
  });
});

// Obtenir mes conversations
router.get('/conversations', (req, res) => {
  const userId = req.userId;
  const sql = `
    SELECT c.*,
           CASE 
             WHEN c.driver_id = ? THEN p.first_name || ' ' || p.last_name
             ELSE d.first_name || ' ' || d.last_name
           END as other_user_name,
           CASE 
             WHEN c.driver_id = ? THEN p.id
             ELSE d.id
           END as other_user_id,
           ds.name as departure_station,
           ars.name as arrival_station,
           r.departure_date,
           (SELECT COUNT(*) FROM messages m 
            WHERE m.conversation_id = c.id 
            AND m.sender_id != ? 
            AND m.is_read = 0) as unread_count
    FROM conversations c
    JOIN users d ON c.driver_id = d.id
    JOIN users p ON c.passenger_id = p.id
    JOIN rides r ON c.ride_id = r.id
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    WHERE c.driver_id = ? OR c.passenger_id = ?
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
  `;

  db.all(sql, [userId, userId, userId, userId, userId], (err, conversations) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    res.json({ success: true, conversations: conversations, total: conversations.length });
  });
});

// Envoyer un message
router.post('/messages', (req, res) => {
  const senderId = req.userId;
  const { conversationId, message } = req.body;
  if (!conversationId || !message || message.trim() === '') return res.status(400).json({ success: false, message: 'Conversation ID et message requis' });

  const checkSql = `SELECT * FROM conversations WHERE id = ? AND (driver_id = ? OR passenger_id = ?)`;
  db.get(checkSql, [conversationId, senderId, senderId], (err, conv) => {
    if (err || !conv) return res.status(403).json({ success: false, message: 'Conversation non trouvée ou accès refusé' });
    const insertSql = `INSERT INTO messages (conversation_id, sender_id, message) VALUES (?, ?, ?)`;
    db.run(insertSql, [conversationId, senderId, message.trim()], function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Erreur envoi message' });
      const messageId = this.lastID;
      const updateSql = `UPDATE conversations SET last_message = ?, last_message_at = CURRENT_TIMESTAMP WHERE id = ?`;
      db.run(updateSql, [message.trim(), conversationId], (err) => {
        if (err) console.error('Erreur mise à jour conversation:', err);
        const getSql = `SELECT m.*, u.first_name as sender_first_name, u.last_name as sender_last_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`;
        db.get(getSql, [messageId], (err, newMessage) => {
          if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
          res.status(201).json({ success: true, message: newMessage });
        });
      });
    });
  });
});

// Obtenir messages d'une conversation
router.get('/messages/:conversationId', (req, res) => {
  const userId = req.userId;
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const checkSql = `SELECT * FROM conversations WHERE id = ? AND (driver_id = ? OR passenger_id = ?)`;
  db.get(checkSql, [conversationId, userId, userId], (err, conv) => {
    if (err || !conv) return res.status(403).json({ success: false, message: 'Conversation non trouvée ou accès refusé' });
    const offset = (page - 1) * limit;
    const sql = `SELECT m.*, u.first_name as sender_first_name, u.last_name as sender_last_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = ? ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    db.all(sql, [conversationId, parseInt(limit), offset], (err, messages) => {
      if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
      messages.reverse();
      const updateSql = `UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`;
      db.run(updateSql, [conversationId, userId]);
      res.json({ success: true, messages: messages, total: messages.length });
    });
  });
});

// Unread count
router.get('/unread-count', (req, res) => {
  const userId = req.userId;
  const sql = `SELECT COUNT(*) as unread_count FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE (c.driver_id = ? OR c.passenger_id = ?) AND m.sender_id != ? AND m.is_read = 0`;
  db.get(sql, [userId, userId, userId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    res.json({ success: true, unread_count: result.unread_count || 0 });
  });
});

// Delete conversation
router.delete('/conversations/:id', (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const checkSql = `SELECT * FROM conversations WHERE id = ? AND (driver_id = ? OR passenger_id = ?)`;
  db.get(checkSql, [id, userId, userId], (err, conv) => {
    if (err || !conv) return res.status(403).json({ success: false, message: 'Conversation non trouvée ou accès refusé' });
    const deleteSql = 'DELETE FROM conversations WHERE id = ?';
    db.run(deleteSql, [id], function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Erreur suppression' });
      res.json({ success: true, message: 'Conversation supprimée' });
    });
  });
});

module.exports = router;
