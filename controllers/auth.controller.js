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
  // Changer le mot de passe (Connecté)
  changePassword: async (req, res) => {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    }

    try {
      // 1. Récupérer l'utilisateur avec son hash
      const sql = 'SELECT password FROM users WHERE id = ?';
      const user = await db.get(sql, [userId]);

      if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

      // 2. Vérifier l'ancien mot de passe
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect' });
      }

      // 3. Valider le nouveau mot de passe
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
      }

      // 4. Hasher et sauvegarder
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

      res.json({ success: true, message: 'Mot de passe mis à jour avec succès' });
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // INSCRIPTION ÉTAPE 1: Vérification email universitaire
  checkUniversityEmail: async (req, res) => {
    try {
      let { email } = req.body;
      if (typeof email === 'string') email = email.trim();

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email requis'
        });
      }

      // Si l'email existe déjà en base, indiquez-le (utile pour le flux "J'ai déjà un compte")
      User.findByEmail(email, (err, existingUser) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
        if (existingUser) {
          // Retour normalisé: frontend peut décider d'afficher l'écran de connexion
          return res.json({ success: true, exists: true, message: 'Compte existant' });
        }

        // Vérifier si email universitaire valide (pour les nouvelles inscriptions)
        User.isValidUniversityEmail(email, async (err, isValid) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Erreur serveur' });
          }

          if (!isValid) {
            return res.status(400).json({ success: false, message: 'Email universitaire invalide. Utilisez un email de votre université.' });
          }

          // Générer code de vérification
          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

          // Sauvegarder code
          User.saveVerificationCode(email, verificationCode, expiresAt, async (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Erreur lors de la génération du code' });
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

              res.json({ success: true, message: 'Code de vérification envoyé par email', email, debug_code: process.env.NODE_ENV === 'development' ? verificationCode : undefined });
            } catch (emailError) {
              console.error('Erreur envoi email:', emailError);
              res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email' });
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

  // Vérifier si un email existe déjà (endpoint explicite pour le flux "J'ai déjà un compte")
  checkEmailExists: async (req, res) => {
    try {
      let { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email requis' });
      if (typeof email === 'string') email = email.trim();

      User.findByEmail(email, (err, user) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
        if (!user) return res.json({ success: true, exists: false });
        // Ne pas renvoyer le mot de passe
        const { password, ...userSafe } = user;
        return res.json({ success: true, exists: true, user: userSafe });
      });
    } catch (error) {
      console.error('Erreur checkEmailExists:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
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

        // Marquer l'utilisateur comme vérifié
        User.verifyUserByEmail(email, (verErr) => {
          if (verErr) {
            console.error('Erreur mise à jour is_verified:', verErr);
            return res.status(500).json({ success: false, message: 'Erreur serveur' });
          }

          // Supprimer le code utilisé
          User.deleteVerificationCode(verification.id, (delErr) => {
            if (delErr) console.error('Erreur suppression code:', delErr);
          });

          res.json({
            success: true,
            message: 'Email vérifié avec succès',
            email: email,
            verified: true
          });
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

  // INSCRIPTION COMPLÈTE - VERSION RÉELLE AVEC VÉRIFICATION
  register: async (req, res) => {
    try {
      const { email, password, first_name, last_name, phone, university, profile_type, student_id: providedStudentId } = req.body;

      // Validation
      // Validation (phone is now optional)
      if (!email || !password || !first_name || !last_name || !university || !profile_type) {
        return res.status(400).json({
          success: false,
          message: 'Tous les champs obligatoires sont requis (Email, Mot de passe, Nom, Prénom, Université, Profil)'
        });
      }

      // ✅ CORRECTION : Créer une nouvelle variable pour student_id
      let finalStudentId = providedStudentId;

      if (profile_type === 'student') {
        // Générer un student_id automatique si non fourni
        if (!finalStudentId) {
          const emailPrefix = email.split('@')[0];
          const timestamp = Date.now().toString().slice(-6);
          finalStudentId = `${emailPrefix}_${timestamp}`;
        }
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

        // Validation de la complexité du mot de passe
        const pwdRegex = /(?=^.{8,}$)(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*/;
        if (!pwdRegex.test(password)) {
          return res.status(400).json({
            success: false,
            message: 'Le mot de passe doit faire au moins 8 caractères et contenir une majuscule, un chiffre et un symbole'
          });
        }

        // Hacher mot de passe
        const hashedPassword = await bcrypt.hash(password, 12);

        // ✅ CRÉER UTILISATEUR NON VÉRIFIÉ
        User.create({
          email,
          password: hashedPassword,
          first_name,
          last_name,
          phone: phone || null,
          university,
          profile_type,
          student_id: finalStudentId,
          is_verified: 0 // ⚠️ IMPORTANT : Non vérifié au départ
        }, (err, newUser) => {
          if (err) {
            console.error('Erreur création utilisateur:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la création du compte'
            });
          }

          // ✅ GÉNÉRER ET ENVOYER LE CODE DE VÉRIFICATION RÉEL
          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          // REMPLACE PAR :
          // REMPLACE PAR :
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          const expiresAtISO = expiresAt.toISOString(); // Format SQLite compatible

          User.saveVerificationCode(email, verificationCode, expiresAtISO, async (err) => {
            if (err) {
              console.error('Erreur sauvegarde code:', err);
              // On continue quand même, l'utilisateur pourra redemander un code
            }

            // ✅ ENVOYER EMAIL DE VÉRIFICATION RÉEL
            try {
              await transporter.sendMail({
                from: '"Moov Université" <noreply@moov-university.com>',
                to: email,
                subject: 'Vérifiez votre email - Moov',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1E3A8A;">Bienvenue sur Moov ! 🚗</h2>
                  <p>Votre compte a été créé avec succès.</p>
                  <p>Pour finaliser votre inscription, voici votre code de vérification :</p>
                  <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
                    <strong>${verificationCode}</strong>
                  </div>
                  <p><strong>Ce code expirera dans 10 minutes.</strong></p>
                  <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
                  <hr style="margin: 30px 0;">
                  <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} Moov - Covoiturage Universitaire</p>
                </div>
              `
              });
              console.log(`✅ Email de vérification envoyé à ${email}`);
            } catch (emailError) {
              console.error('❌ Erreur envoi email vérification:', emailError);
            }

            // ✅ ENVOYER EMAIL DE BIENVENUE AUSSI
            transporter.sendMail({
              from: '"Moov Université" <welcome@moov-university.com>',
              to: email,
              subject: 'Bienvenue sur Moov ! 🎉',
              html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1E3A8A;">Bonjour ${first_name} ! 👋</h2>
                <p>Votre compte Moov a été créé avec succès !</p>
                <p><strong>Important :</strong> Vérifiez votre email avec le code reçu pour activer votre compte.</p>
                <p>Une fois vérifié, vous pourrez :</p>
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
                    Accéder à Moov
                  </a>
                </p>
                <hr style="margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">
                  © ${new Date().getFullYear()} Moov - Covoiturage Universitaire
                </p>
              </div>
            `
            }).catch(err => console.error('Erreur email de bienvenue:', err));

            // ✅ RÉPONSE POUR FLUTTER
            res.status(201).json({
              success: true,
              message: 'Compte créé ! Vérifiez votre email pour le code.',
              user: {
                id: newUser.id,
                email: newUser.email,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                university,
                profile_type,
                is_verified: false // ⚠️ Important : dire à Flutter que c'est pas vérifié
              },
              token: generateToken(newUser.id), // Token temporaire
              needs_verification: true, // ⚠️ Important : Flutter doit afficher l'écran de vérification
              debug_code: verificationCode
            });
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
  },



  // MOT DE PASSE OUBLIÉ
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

      User.findByEmail(email, (err, user) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
        if (!user) {
          // Pour sécurité, on dit quand même que l'email a été envoyé si le compte n'existe pas
          return res.json({ success: true, message: 'Si ce compte existe, un email a été envoyé.' });
        }

        // Générer code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

        User.savePasswordResetCode(email, code, expiresAt, async (err) => {
          if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });

          try {
            await transporter.sendMail({
              from: '"Moov Support" <noreply@moov-university.com>',
              to: email,
              subject: 'Réinitialisation de mot de passe',
              html: `
                <h3>Réinitialisation de mot de passe</h3>
                <p>Utilisez le code suivant pour réinitialiser votre mot de passe :</p>
                <h1>${code}</h1>
                <p>Ce code expire dans 15 minutes.</p>
              `
            });
            res.json({ success: true, message: 'Email envoyé', debug_code: process.env.NODE_ENV === 'development' ? code : undefined });
          } catch (e) {
            console.error('Email error:', e);
            res.status(500).json({ success: false, message: "Erreur lors de l'envoi de l'email" });
          }
        });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  },

  // RÉINITIALISER MOT DE PASSE
  resetPassword: async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
      }

      // Valider complexité mdp
      const pwdRegex = /(?=^.{8,}$)(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*/;
      if (!pwdRegex.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Le mot de passe doit faire au moins 8 caractères et contenir une majuscule, un chiffre et un symbole'
        });
      }

      User.verifyPasswordResetCode(email, code, async (err, record) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
        if (!record) return res.status(400).json({ success: false, message: 'Code invalide ou expiré' });

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        User.updatePassword(email, hashedPassword, (err) => {
          if (err) return res.status(500).json({ success: false, message: 'Erreur redéfinition mot de passe' });

          User.deletePasswordResetCodes(email, () => { }); // Cleanup
          res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
        });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

}; // <-- FERMETURE CORRECTE DE L'OBJET

module.exports = authController;