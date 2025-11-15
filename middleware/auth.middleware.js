const { verifyToken } = require('../config/jwt');

const authMiddleware = (req, res, next) => {
  // 1. Récupérer le token du header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }

  // 2. Extraire le token
  const token = authHeader.split(' ')[1];

  // 3. Vérifier le token
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }

  // 4. Ajouter l'ID utilisateur à la requête
  req.userId = decoded.userId;
  
  // 5. Continuer
  next();
};

module.exports = authMiddleware;