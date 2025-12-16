// controllers/station.controller.js
const db = require('../config/db');
const Station = require('../models/station.model');
const Favorite = require('../models/favorite.model');
const Route = require('../models/route.model');

const stationController = {
  // AUTO-COMPLÉTION DES STATIONS
  autocomplete: async (req, res) => {
    try {
      const { q, type, limit = 10 } = req.query;
      const userId = req.userId || null;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Veuillez saisir au moins 2 caractères'
        });
      }

      Station.search(q, parseInt(limit), userId, (err, stations) => {
        if (err) {
          console.error('Erreur recherche stations:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche'
          });
        }

        // Retourner les stations telles qu'elles sont en base (sans concaténation)
        const suggestions = stations.map(station => ({
          id: station.id,
          name: station.name,
          city: station.city,
          address: station.address,
          type: station.type,
          university_name: station.university_name,
          is_favorite: station.is_favorite > 0,
          ride_count: station.ride_count
        }));

        res.json({
          success: true,
          query: q,
          suggestions,
          count: suggestions.length
        });
      });
    } catch (error) {
      console.error('Erreur auto-complétion:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // STATIONS PRÈS DE MOI (géolocalisation)
  nearby: async (req, res) => {
    try {
      const { lat, lng, radius = 10, limit = 20 } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'Coordonnées GPS requises'
        });
      }

      Station.searchNearby(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius),
        parseInt(limit),
        (err, stations) => {
          if (err) {
            console.error('Erreur recherche stations proches:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la recherche'
            });
          }

          res.json({
            success: true,
            location: { lat, lng },
            radius: radius,
            stations: stations.map(s => ({
              ...s,
              distance_km: Math.round(s.distance_km * 10) / 10
            })),
            count: stations.length
          });
        }
      );
    } catch (error) {
      console.error('Erreur stations proches:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // STATIONS D'UNE UNIVERSITÉ
  byUniversity: async (req, res) => {
    try {
      const { universityId } = req.params;

      Station.getByUniversity(universityId, (err, stations) => {
        if (err) {
          console.error('Erreur récupération stations:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        res.json({
          success: true,
          stations,
          count: stations.length
        });
      });
    } catch (error) {
      console.error('Erreur stations université:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // STATIONS D'UNE VILLE
  byCity: async (req, res) => {
    try {
      const { city } = req.params;

      Station.getByCity(city, (err, stations) => {
        if (err) {
          console.error('Erreur récupération stations:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        res.json({
          success: true,
          city,
          stations,
          count: stations.length
        });
      });
    } catch (error) {
      console.error('Erreur stations ville:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // AJOUTER AUX FAVORIS
  addToFavorites: async (req, res) => {
    try {
      const userId = req.userId;
      const { stationId, type = 'both' } = req.body;

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'ID de station requis'
        });
      }

      Favorite.addStation(userId, stationId, type, (err) => {
        if (err) {
          console.error('Erreur ajout favoris:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'ajout aux favoris'
          });
        }

        res.json({
          success: true,
          message: 'Station ajoutée aux favoris'
        });
      });
    } catch (error) {
      console.error('Erreur ajout favoris:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // RETIRER DES FAVORIS
  removeFromFavorites: async (req, res) => {
    try {
      const userId = req.userId;
      const { stationId, type } = req.body;

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'ID de station requis'
        });
      }

      Favorite.removeStation(userId, stationId, type, (err) => {
        if (err) {
          console.error('Erreur suppression favoris:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression des favoris'
          });
        }

        res.json({
          success: true,
          message: 'Station retirée des favoris'
        });
      });
    } catch (error) {
      console.error('Erreur suppression favoris:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // MES STATIONS FAVORITES
  myFavorites: async (req, res) => {
    try {
      const userId = req.userId;
      const { type } = req.query;

      Favorite.getUserStations(userId, type, (err, favorites) => {
        if (err) {
          console.error('Erreur récupération favoris:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        res.json({
          success: true,
          favorites,
          count: favorites.length
        });
      });
    } catch (error) {
      console.error('Erreur favoris:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // STATIONS POPULAIRES
  popular: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      Station.getPopular(parseInt(limit), (err, stations) => {
        if (err) {
          console.error('Erreur stations populaires:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        res.json({
          success: true,
          stations,
          count: stations.length
        });
      });
    } catch (error) {
      console.error('Erreur stations populaires:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // STATIONS RÉCENTES (historique)
  recent: async (req, res) => {
    try {
      const userId = req.userId;
      const { limit = 10 } = req.query;

      Station.getRecent(userId, parseInt(limit), (err, stations) => {
        if (err) {
          console.error('Erreur stations récentes:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        res.json({
          success: true,
          stations,
          count: stations.length
        });
      });
    } catch (error) {
      console.error('Erreur stations récentes:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // ITINÉRAIRES POPULAIRES
  popularRoutes: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      Route.getPopularRoutes(parseInt(limit), (err, routes) => {
        if (err) {
          console.error('Erreur itinéraires populaires:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        res.json({
          success: true,
          routes,
          count: routes.length
        });
      });
    } catch (error) {
      console.error('Erreur itinéraires populaires:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
};

module.exports = stationController;