// controllers/auth.controller.js - VERSION CORRIGÉE
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { generateToken } = require('../config/jwt');
const nodemailer = require('nodemailer');
const db = require('../config/db');  // Déplacé en haut pour cohérence

// Configuration email (à mettre dans .env)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const authController = {
  // INSCRIPTION ÉTAPE 1: Vérification email universitaire
  checkUniversityEmail: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email requis'
        });
      }

      // Vérifier si email universitaire valide
      User.isValidUniversityEmail(email, async (err, isValid) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        if (!isValid) {
          return res.status(400).json({
            success: false,
            message: 'Email universitaire invalide. Utilisez un email de votre université.'
          });
        }

        // Vérifier si email existe déjà
        User.findByEmail(email, (err, existingUser) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Erreur serveur'
            });
          }

          if (existingUser) {
            return res.status(409).json({
              success: false,
              message: 'Cet email est déjà utilisé'
            });
          }

          // Générer code de vérification
          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

          // Sauvegarder code
          User.saveVerificationCode(email, verificationCode, expiresAt, async (err) => {
            if (err) {
              return res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération du code'
              });
            }

            // Envoyer email
            try {
              await transporter.sendMail({
                from: '"Moov Université" <noreply@moov-university.com>',
                to: email,
                subject: 'Vérification de votre email - Moov',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1E3A8A;">Bienvenue sur Moov ! 🚗</h2>
                    <p>Votre code de vérification est :</p>
                    <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
                      <strong>${verificationCode}</strong>
                    </div>
                    <p>Ce code expirera dans 10 minutes.</p>
                    <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} Moov - Covoiturage Universitaire</p>
                  </div>
                `
              });

              res.json({
                success: true,
                message: 'Code de vérification envoyé par email',
                email: email,
                // Pour le développement seulement
                debug_code: process.env.NODE_ENV === 'development' ? verificationCode : undefined
              });
            } catch (emailError) {
              console.error('Erreur envoi email:', emailError);
              res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de l\'email'
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Erreur vérification email:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // VÉRIFICATION DU CODE EMAIL
  verifyEmailCode: async (req, res) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          message: 'Email et code requis'
        });
      }

      // Vérifier le code
      User.verifyCode(email, code, (err, verification) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        if (!verification) {
          return res.status(400).json({
            success: false,
            message: 'Code invalide ou expiré'
          });
        }

        // Supprimer le code utilisé
        User.deleteVerificationCode(verification.id, (err) => {
          if (err) console.error('Erreur suppression code:', err);
        });

        res.json({
          success: true,
          message: 'Email vérifié avec succès',
          email: email,
          verified: true
        });
      });
    } catch (error) {
      console.error('Erreur vérification code:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // INSCRIPTION COMPLÈTE
  register: async (req, res) => {
    try {
      const { email, password, first_name, last_name, phone, university, profile_type, student_id } = req.body;

      // Validation
      if (!email || !password || !first_name || !last_name || !phone || !university || !profile_type) {
        return res.status(400).json({
          success: false,
          message: 'Tous les champs obligatoires sont requis'
        });
      }

      if (profile_type === 'student' && !student_id) {
        return res.status(400).json({
          success: false,
          message: 'Numéro étudiant requis pour les étudiants'
        });
      }

      // Vérifier si email existe déjà
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

        // Hacher mot de passe
        const hashedPassword = await bcrypt.hash(password, 12);

        // Créer utilisateur
        User.create({
          email,
          password: hashedPassword,
          first_name,
          last_name,
          phone,
          university,
          profile_type,
          student_id
        }, (err, newUser) => {
          if (err) {
            console.error('Erreur création utilisateur:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la création du compte'
            });
          }

          // Générer token
          const token = generateToken(newUser.id);

          // Envoyer email de bienvenue
          transporter.sendMail({
            from: '"Moov Université" <welcome@moov-university.com>',
            to: email,
            subject: 'Bienvenue sur Moov ! 🎉',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1E3A8A;">Bonjour ${first_name} ! 👋</h2>
                <p>Votre compte Moov a été créé avec succès !</p>
                <p>Vous pouvez maintenant :</p>
                <ul>
                  <li>🚗 Rechercher des trajets vers votre université</li>
                  <li>👥 Proposer vos propres trajets</li>
                  <li>⭐ Noter vos covoitureurs</li>
                  <li>🎯 Rejoindre la communauté ${university}</li>
                </ul>
                <p style="margin-top: 30px;">
                  <a href="${process.env.APP_URL || 'http://localhost:3000'}" 
                     style="background-color: #1E3A8A; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 5px; display: inline-block;">
                    Commencer à covoiturer
                  </a>
                </p>
                <hr style="margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">
                  © ${new Date().getFullYear()} Moov - Covoiturage Universitaire
                </p>
              </div>
            `
          }).catch(err => console.error('Erreur email de bienvenue:', err));

          res.status(201).json({
            success: true,
            message: 'Compte créé avec succès!',
            user: {
              id: newUser.id,
              email: newUser.email,
              first_name: newUser.first_name,
              last_name: newUser.last_name,
              university,
              profile_type
            },
            token
          });
        });
      });
    } catch (error) {
      console.error('Erreur inscription:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // CONNEXION
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email et mot de passe requis'
        });
      }

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

        // Vérifier mot de passe
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: 'Email ou mot de passe incorrect'
          });
        }

        // Vérifier si email est vérifié
        if (!user.is_verified) {
          return res.status(403).json({
            success: false,
            message: 'Veuillez vérifier votre email avant de vous connecter',
            needs_verification: true
          });
        }

        // Générer token
        const token = generateToken(user.id);

        // Mettre à jour dernière connexion
        const updateSql = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        db.run(updateSql, [user.id]);

        // Retourner utilisateur (sans mot de passe)
        const { password: _, ...userWithoutPassword } = user;

        res.json({
          success: true,
          message: 'Connexion réussie!',
          user: userWithoutPassword,
          token
        });
      });
    } catch (error) {
      console.error('Erreur connexion:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // RÉINITIALISER LE CODE DE VÉRIFICATION
  resendVerificationCode: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email requis'
        });
      }

      // Vérifier si utilisateur existe
      User.findByEmail(email, async (err, user) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }

        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'Utilisateur non trouvé'
          });
        }

        if (user.is_verified) {
          return res.status(400).json({
            success: false,
            message: 'Email déjà vérifié'
          });
        }

        // Générer nouveau code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Sauvegarder code
        User.saveVerificationCode(email, verificationCode, expiresAt, async (err) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la génération du code'
            });
          }

          // Envoyer email
          try {
            await transporter.sendMail({
              from: '"Moov Université" <noreply@moov-university.com>',
              to: email,
              subject: 'Nouveau code de vérification - Moov',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1E3A8A;">Nouveau code de vérification</h2>
                  <p>Voici votre nouveau code :</p>
                  <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
                    <strong>${verificationCode}</strong>
                  </div>
                  <p>Ce code expirera dans 10 minutes.</p>
                  <hr style="margin: 30px 0;">
                  <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} Moov - Covoiturage Universitaire</p>
                </div>
              `
            });

            res.json({
              success: true,
              message: 'Nouveau code envoyé par email',
              debug_code: process.env.NODE_ENV === 'development' ? verificationCode : undefined
            });
          } catch (emailError) {
            console.error('Erreur envoi email:', emailError);
            res.status(500).json({
              success: false,
              message: 'Erreur lors de l\'envoi de l\'email'
            });
          }
        });
      });
    } catch (error) {
      console.error('Erreur renvoi code:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // LISTE DES UNIVERSITÉS
  getUniversities: (req, res) => {
    User.getAllUniversities((err, universities) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur'
        });
      }

      res.json({
        success: true,
        universities
      });
    });
  },  // <-- AJOUT DE CETTE VIRGULE ICI !

  // Mettre à jour le profil
  updateProfile: async (req, res) => {
    try {
      const userId = req.userId;
      const { first_name, last_name, phone, is_driver, has_car, car_model, car_seats } = req.body;

      // Validation
      if (!first_name || !last_name || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Prénom, nom et téléphone sont requis'
        });
      }

      // Vérifier que l'utilisateur existe
      User.findById(userId, (err, existingUser) => {
        if (err || !existingUser) {
          return res.status(404).json({
            success: false,
            message: 'Utilisateur non trouvé'
          });
        }

        // Mettre à jour le profil
        User.updateProfile(userId, {
          first_name,
          last_name,
          phone,
          is_driver: is_driver || false,
          has_car: has_car || false,
          car_model: car_model || null,
          car_seats: car_seats || 0
        }, (err) => {
          if (err) {
            console.error('Erreur mise à jour profil:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la mise à jour du profil'
            });
          }

          // Récupérer l'utilisateur mis à jour
          User.findById(userId, (err, updatedUser) => {
            if (err) {
              return res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du profil'
              });
            }

            res.json({
              success: true,
              message: 'Profil mis à jour avec succès',
              user: {
                id: updatedUser.id,
                first_name: updatedUser.first_name,
                last_name: updatedUser.last_name,
                phone: updatedUser.phone,
                email: updatedUser.email,
                university: updatedUser.university,
                is_driver: updatedUser.is_driver,
                has_car: updatedUser.has_car,
                car_model: updatedUser.car_model,
                car_seats: updatedUser.car_seats,
                rating: updatedUser.rating,
                total_trips: updatedUser.total_trips
              }
            });
          });
        });
      });
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

}; // <-- FERMETURE CORRECTE DE L'OBJET

module.exports = authController;