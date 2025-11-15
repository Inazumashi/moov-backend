const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { generateToken } = require('../config/jwt');

const authController = {
  // INSCRIPTION
  register: async (req, res) => {
    try {
      const { email, password, first_name, last_name, phone } = req.body;

      // 1. Vérification des champs
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email et mot de passe requis'
        });
      }

      // 2. Vérifier si l'email existe déjà
      User.findByEmail(email, async (err, existingUser) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Cet email est déjà utilisé'
          });
        }

        // 3. Hacher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Créer l'utilisateur
        User.create({
          email,
          password: hashedPassword,
          first_name,
          last_name,
          phone
        }, (err, newUser) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la création du compte'
            });
          }

          // 5. Générer le token
          const token = generateToken(newUser.id);

          // 6. Réponse succès
          res.status(201).json({
            success: true,
            message: 'Compte créé avec succès!',
            user: {
              id: newUser.id,
              email,
              first_name,
              last_name
            },
            token
          });
        });
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // CONNEXION
  login: (req, res) => {
    const { email, password } = req.body;

    // 1. Vérification des champs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // 2. Chercher l'utilisateur
    User.findByEmail(email, async (err, user) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur'
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // 3. Vérifier le mot de passe
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // 4. Générer le token
      const token = generateToken(user.id);

      // 5. Réponse succès
      res.json({
        success: true,
        message: 'Connexion réussie!',
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        },
        token
      });
    });
  }
};

module.exports = authController;