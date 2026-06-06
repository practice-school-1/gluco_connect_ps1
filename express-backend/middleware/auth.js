const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT Authentication Middleware
 * 
 * Extracts and verifies a JWT from the Authorization header.
 * On success, attaches the full User document to `req.user`.
 * 
 * Usage: router.post('/protected', authMiddleware, handler)
 * 
 * Expected header format: Authorization: Bearer <jwt_token>
 */
async function authMiddleware(req, res, next) {
  try {
    // 1. Extract the token from the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required. Please provide a valid Bearer token.'
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find the user in the database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found. Token may be invalid or the account was deleted.'
      });
    }

    // 4. Attach the user document to the request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(500).json({ error: 'Authentication failed.' });
  }
}

module.exports = authMiddleware;
