const db = require('../config/db');

// Fonction pour créer une nouvelle réservation
const create = async ({ rideId, passengerId, seatsBooked }) => {
    // TODO: Implémenter une requête SQL pour insérer une nouvelle réservation.
    // IMPORTANT: Cela doit être fait dans une transaction pour mettre à jour les sièges disponibles dans 'rides' en même temps.
};

// Fonction pour lister les réservations d'un utilisateur (pour l'écran Accueil)
const findByUser = async (passengerId) => {
    // TODO: Implémenter une requête SQL pour récupérer les réservations d'un utilisateur, en joignant avec les détails du trajet ('rides').
};

// TODO: Ajouter une fonction pour annuler une réservation.

module.exports = {
    create,
    findByUser,
    // ...
};