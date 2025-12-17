// controllers/payment.controller.js
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');

exports.validatePayPalPayment = (req, res) => {
  // 1. On récupère les infos envoyées par Flutter
  // NOTE: req.user.id vient de ton middleware d'authentification (token JWT)
  const userId = req.user ? req.user.id : null; 
  const { paymentId, amount, currency } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Utilisateur non authentifié." });
  }

  if (!paymentId || !amount) {
    return res.status(400).json({ message: "Données de paiement manquantes." });
  }

  // 2. On vérifie si ce paiement a DÉJÀ été traité (pour éviter les doublons)
  Transaction.findByTransactionId(paymentId, (err, existingTransaction) => {
    if (err) {
      return res.status(500).json({ message: "Erreur serveur lors de la vérification.", error: err.message });
    }

    if (existingTransaction) {
      return res.status(409).json({ message: "Ce paiement a déjà été validé." });
    }

    // 3. On enregistre la transaction dans la base de données
    const transactionData = {
      user_id: userId,
      amount: amount,
      currency: currency || 'MAD',
      payment_method: 'PAYPAL',
      transaction_id: paymentId,
      status: 'COMPLETED',
      description: 'Abonnement Premium Moov'
    };

    Transaction.create(transactionData, (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Erreur lors de l'enregistrement de la transaction.", error: err.message });
      }

      // 4. Si la transaction est sauvée, on active le Premium de l'utilisateur
      User.activatePremium(userId, (err) => {
        if (err) {
          // Cas rare : paiement noté mais échec update user. Idéalement il faudrait loguer ça.
          return res.status(500).json({ message: "Erreur lors de l'activation du compte Premium.", error: err.message });
        }

        // 5. TOUT EST BON ! On répond à Flutter
        res.status(200).json({
          success: true,
          message: "Paiement validé et Premium activé !",
          premium_active: true
        });
      });
    });
  });
};