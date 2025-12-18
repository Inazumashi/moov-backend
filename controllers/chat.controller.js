const db = require('../config/db');

const chatController = {
  // Créer ou récupérer une conversation
  createOrGet: async (req, res) => {
    const userId = req.userId;
    const { ride_id } = req.body;

    if (!ride_id) {
      return res.status(400).json({
        success: false,
        message: 'ID du trajet requis'
      });
    }

    try {
      // 1. Vérifier que le trajet existe et est actif
      const rideSql = `
        SELECT id, driver_id, status 
        FROM rides 
        WHERE id = ? AND status = 'active'
      `;
      const ride = await db.get(rideSql, [ride_id]);

      if (!ride) {
        return res.status(404).json({
          success: false,
          message: 'Trajet non trouvé ou non disponible'
        });
      }

      // 2. Vérifier que l'utilisateur est impliqué dans le trajet
      // (soit conducteur, soit passager ayant réservé)
      const isDriver = ride.driver_id === userId;

      let isPassenger = false;
      if (!isDriver) {
        const passengerSql = `
          SELECT id 
          FROM bookings 
          WHERE ride_id = ? 
          AND passenger_id = ? 
          AND status IN ('confirmed', 'pending')
        `;
        const booking = await db.get(passengerSql, [ride_id, userId]);
        isPassenger = !!booking;
      }

      if (!isDriver && !isPassenger) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne participez pas à ce trajet'
        });
      }

      // 3. Chercher une conversation existante
      const existingSql = `
        SELECT c.* 
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.ride_id = ? AND cp.user_id = ?
        LIMIT 1
      `;
      const existing = await db.get(existingSql, [ride_id, userId]);

      if (existing) {
        // 4. Si conversation existe, la retourner
        // Récupérer les participants
        const participantsSql = `
          SELECT u.id, u.first_name, u.last_name
          FROM conversation_participants cp
          JOIN users u ON cp.user_id = u.id
          WHERE cp.conversation_id = ?
        `;
        const participants = await db.all(participantsSql, [existing.id]);

        return res.json({
          success: true,
          data: {
            ...existing,
            participants
          }
        });
      }

      // 5. Si pas de conversation, en créer une nouvelle
      // Récupérer tous les participants (conducteur + passagers confirmés)
      const participantsSql = `
        SELECT DISTINCT ? as user_id  -- Le conducteur
        UNION
        SELECT passenger_id as user_id
        FROM bookings 
        WHERE ride_id = ? 
        AND status IN ('confirmed', 'pending')
      `;

      const participantsRows = await db.all(participantsSql, [ride.driver_id, ride_id]);
      const participantIds = participantsRows.map(row => row.user_id);

      // Créer la conversation (utiliser une transaction)
      const newConvId = await createConversationWithParticipants(
        ride_id,
        participantIds
      );

      // Récupérer la conversation créée
      const convSql = `
        SELECT c.*, 
        GROUP_CONCAT(cp.user_id) as participant_ids
        FROM conversations c
        LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.id = ?
        GROUP BY c.id
      `;
      const conversation = await db.get(convSql, [newConvId]);

      // Récupérer les infos des participants
      const participantsInfoSql = `
        SELECT u.id, u.first_name, u.last_name
        FROM users u
        WHERE u.id IN (${participantIds.join(',')})
      `;
      const participants = await db.all(participantsInfoSql);

      res.status(201).json({
        success: true,
        data: {
          ...conversation,
          participants
        }
      });

    } catch (error) {
      console.error('Erreur création conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Fonction utilitaire pour créer une conversation avec participants
  createConversationWithParticipants: async (rideId, participantIds) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db.run('BEGIN TRANSACTION');

        // Créer la conversation
        const convSql = `
          INSERT INTO conversations (ride_id, created_at)
          VALUES (?, CURRENT_TIMESTAMP)
        `;
        const result = await db.run(convSql, [rideId]);
        const conversationId = result.lastID;

        // Ajouter les participants
        for (const userId of participantIds) {
          await db.run(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
            [conversationId, userId]
          );
        }

        await db.run('COMMIT');
        resolve(conversationId);
      } catch (error) {
        await db.run('ROLLBACK');
        reject(error);
      }
    });
  },

  // Supprimer un message
  deleteMessage: async (req, res) => {
    const userId = req.userId;
    const { id } = req.params;

    try {
      const sql = 'SELECT sender_id FROM messages WHERE id = ?';
      const message = await db.get(sql, [id]);

      if (!message) {
        return res.status(404).json({ success: false, message: 'Message non trouvé' });
      }

      if (message.sender_id !== userId) {
        return res.status(403).json({ success: false, message: 'Vous ne pouvez supprimer que vos propres messages' });
      }

      await db.run('DELETE FROM messages WHERE id = ?', [id]);
      res.json({ success: true, message: 'Message supprimé' });
    } catch (error) {
      console.error('Erreur suppression message:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // ... autres méthodes existantes ...
  // Obtenir le nombre de messages non lus par conversation
  getUnreadCountByConversation: async (req, res) => {
    const userId = req.userId;

    try {
      const sql = `
        SELECT 
          c.id as conversation_id,
          COUNT(m.id) as unread_count
        FROM conversations c
        JOIN messages m ON c.id = m.conversation_id
        WHERE (c.driver_id = ? OR c.passenger_id = ?)
        AND m.sender_id != ?
        AND m.is_read = 0
        GROUP BY c.id
      `;

      const rows = await db.all(sql, [userId, userId, userId]);

      // Convertir en objet { convId: count }
      const unreadMap = {};
      rows.forEach(row => {
        unreadMap[row.conversation_id] = row.unread_count;
      });

      res.json({ success: true, data: unreadMap });
    } catch (error) {
      console.error('Erreur unread by conversation:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
};

module.exports = chatController;