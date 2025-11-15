//Crée et vérifie les Tokens JWT. Quand vous vous connectez, il vous donne un "pass" chiffré.
const jwt = require('jsonwebtoken');

// Générer un token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Vérifier un token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken
};