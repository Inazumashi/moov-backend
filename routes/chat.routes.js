// routes/chat.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../config/db');

// Toutes les routes du chat nécessitent l'authentification
router.use(authMiddleware);

// Obtenir toutes les conversations de l'utilisateur
router.get('/conversations', (req, res) => {
  const userId = req.userId;

  const sql = `
    SELECT 
      c.id,
      c.ride_id,
      r.departure_date,
      r.departure_time,
      ds.name as departure_station,
      ars.name as arrival_station,
      CASE 
        WHEN c.driver_id = ? THEN u2.first_name || ' ' || u2.last_name
        ELSE u1.first_name || ' ' || u1.last_name
      END as other_user_name,
      CASE 
        WHEN c.driver_id = ? THEN c.passenger_id
        ELSE c.driver_id
      END as other_user_id,
      (SELECT message FROM messages 
       WHERE conversation_id = c.id 
       ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages 
       WHERE conversation_id = c.id 
       ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages m 
       WHERE m.conversation_id = c.id 
       AND m.sender_id != ? 
       AND m.is_read = 0) as unread_count
    FROM conversations c
    JOIN rides r ON c.ride_id = r.id
    JOIN stations ds ON r.departure_station_id = ds.id
    JOIN stations ars ON r.arrival_station_id = ars.id
    JOIN users u1 ON c.driver_id = u1.id
    JOIN users u2 ON c.passenger_id = u2.id
    WHERE c.driver_id = ? OR c.passenger_id = ?
    ORDER BY last_message_at DESC NULLS LAST
  `;

  db.all(sql, [userId, userId, userId, userId, userId], (err, conversations) => {
    if (err) {
      console.error('Erreur récupération conversations:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    res.json({ success: true, data: conversations || [] });
  });
});

// Créer ou récupérer une conversation pour un trajet
router.post('/conversations', (req, res) => {
  const userId = req.userId;
  const { ride_id } = req.body;

  if (!ride_id) {
    return res.status(400).json({ success: false, message: 'ride_id requis' });
  }

  // Vérifier que le trajet existe
  const rideSql = 'SELECT driver_id, id FROM rides WHERE id = ?';
  db.get(rideSql, [ride_id], (err, ride) => {
    if (err || !ride) {
      return res.status(404).json({ success: false, message: 'Trajet non trouvé' });
    }

    const driverId = ride.driver_id;
    const passengerId = userId;

    // Vérifier si une conversation existe déjà
    const checkSql = `
      SELECT id FROM conversations 
      WHERE ride_id = ? 
      AND driver_id = ? 
      AND passenger_id = ?
    `;

    db.get(checkSql, [ride_id, driverId, passengerId], (err, existing) => {
      if (existing) {
        return res.json({ success: true, data: existing });
      }

      // Créer nouvelle conversation
      const insertSql = `
        INSERT INTO conversations (ride_id, driver_id, passenger_id, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `;

      db.run(insertSql, [ride_id, driverId, passengerId], function (err) {
        if (err) {
          console.error('Erreur création conversation:', err);
          return res.status(500).json({ success: false, message: 'Erreur serveur' });
        }

        res.json({ success: true, data: { id: this.lastID } });
      });
    });
  });
});

// Obtenir les messages d'une conversation
router.get('/messages/:conversationId', (req, res) => {
  const userId = req.userId;
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  // Vérifier que l'utilisateur fait partie de la conversation
  const checkSql = `
    SELECT id FROM conversations 
    WHERE id = ? 
    AND (driver_id = ? OR passenger_id = ?)
  `;

  db.get(checkSql, [conversationId, userId, userId], (err, conversation) => {
    if (err || !conversation) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const sql = `
      SELECT 
        id,
        conversation_id,
        sender_id,
        message,
        is_read,
        created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `;

    const offset = (page - 1) * limit;
    db.all(sql, [conversationId, parseInt(limit), offset], (err, messages) => {
      if (err) {
        console.error('Erreur récupération messages:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
      }

      res.json({ success: true, data: messages || [] });
    });
  });
});

// Obtenir les nouveaux messages (polling)
router.get('/conversations/:conversationId/new-messages', (req, res) => {
  const userId = req.userId;
  const { conversationId } = req.params;
  const { since } = req.query;

  if (!since) {
    return res.status(400).json({ success: false, message: 'Paramètre since requis' });
  }

  // Vérifier accès
  const checkSql = `
    SELECT id FROM conversations 
    WHERE id = ? 
    AND (driver_id = ? OR passenger_id = ?)
  `;

  db.get(checkSql, [conversationId, userId, userId], (err, conversation) => {
    if (err || !conversation) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const sql = `
      SELECT 
        id,
        conversation_id,
        sender_id,
        message,
        is_read,
        created_at
      FROM messages
      WHERE conversation_id = ?
      AND created_at > ?
      ORDER BY created_at ASC
    `;

    db.all(sql, [conversationId, since], (err, messages) => {
      if (err) {
        console.error('Erreur récupération nouveaux messages:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
      }

      res.json({ success: true, data: messages || [] });
    });
  });
});

// Envoyer un message
router.post('/messages', (req, res) => {
  const userId = req.userId;
  const { conversation_id, message } = req.body;

  if (!conversation_id || !message) {
    return res.status(400).json({
      success: false,
      message: 'conversation_id et message requis'
    });
  }

  // Vérifier que l'utilisateur fait partie de la conversation
  const checkSql = `
    SELECT id FROM conversations 
    WHERE id = ? 
    AND (driver_id = ? OR passenger_id = ?)
  `;

  db.get(checkSql, [conversation_id, userId, userId], (err, conversation) => {
    if (err || !conversation) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const sql = `
      INSERT INTO messages (conversation_id, sender_id, message, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `;

    db.run(sql, [conversation_id, userId, message], function (err) {
      if (err) {
        console.error('Erreur envoi message:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
      }

      res.json({
        success: true,
        data: {
          id: this.lastID,
          conversation_id,
          sender_id: userId,
          message,
          is_read: 0,
          created_at: new Date().toISOString()
        }
      });
    });
  });
});

// Marquer les messages comme lus
router.put('/conversations/:conversationId/mark-read', (req, res) => {
  const userId = req.userId;
  const { conversationId } = req.params;

  const sql = `
    UPDATE messages 
    SET is_read = 1 
    WHERE conversation_id = ? 
    AND sender_id != ? 
    AND is_read = 0
  `;

  db.run(sql, [conversationId, userId], (err) => {
    if (err) {
      console.error('Erreur marquage messages lus:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    res.json({ success: true });
  });
});

// Obtenir le nombre de messages non lus
router.get('/unread-count', (req, res) => {
  const userId = req.userId;

  const sql = `
    SELECT COUNT(*) as count
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE (c.driver_id = ? OR c.passenger_id = ?)
    AND m.sender_id != ?
    AND m.is_read = 0
  `;

  db.get(sql, [userId, userId, userId], (err, result) => {
    if (err) {
      console.error('Erreur comptage non lus:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    res.json({ success: true, unread_count: result.count || 0 });
  });
});

// Obtenir les non lus par conversation
router.get('/unread-by-conversation', (req, res) => {
  const chatController = require('../controllers/chat.controller');
  chatController.getUnreadCountByConversation(req, res);
});

// Supprimer un message
router.delete('/messages/:id', (req, res) => {
  const chatController = require('../controllers/chat.controller');
  chatController.deleteMessage(req, res);
});

module.exports = router;