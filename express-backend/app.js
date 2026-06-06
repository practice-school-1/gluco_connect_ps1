// =========================================================================
// GlucoConnect Backend — Main Application Entry Point
// =========================================================================

// 1. Load environment variables FIRST, before any other imports.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const connectDB = require('./config/db');
const User = require('./models/User');

// Import route modules
const fitbitRoutes = require('./routes/fitbit');
const mealRoutes = require('./routes/meals');
const locationRoutes = require('./routes/locations');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// Middleware
// =========================================================================

// Enable CORS for all origins (tighten in production)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded form bodies (for Fitbit token exchange)
app.use(express.urlencoded({ extended: true }));

// Serve uploaded meal photos statically from the local disk
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// =========================================================================
// Route Mounting
// =========================================================================

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'GlucoConnect Backend',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Fitbit OAuth 2.0 and data sync routes
app.use('/fitbit', fitbitRoutes);

// Meal logging, photo upload, and Vision API routes
app.use('/meals', mealRoutes);

// Zero-cost healthy restaurant locator
app.use('/locations', locationRoutes);

// =========================================================================
// Development-Only: Token Generator
// =========================================================================
// Generates a JWT for testing protected endpoints without a full login flow.
// In production, replace this with your real authentication system.
if (process.env.NODE_ENV !== 'production') {
  app.post('/auth/dev-token', async (req, res) => {
    try {
      const { userId, email } = req.body;

      let user;

      if (userId) {
        // Find existing user by ID
        user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found with that ID.' });
        }
      } else if (email) {
        // Find or create a user by email
        user = await User.findOneAndUpdate(
          { email },
          { $setOnInsert: { email, name: 'Dev User' } },
          { upsert: true, new: true }
        );
      } else {
        return res.status(400).json({
          error: 'Provide either "userId" (existing MongoDB ObjectId) or "email" (to find/create a user).'
        });
      }

      // Generate a JWT that lasts 24 hours
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Development token generated.',
        token,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          hasFitbit: !!user.fitbit?.accessToken
        },
        usage: `Add this header to requests: Authorization: Bearer ${token}`
      });

    } catch (error) {
      console.error('Dev token error:', error.message);
      res.status(500).json({ error: 'Failed to generate dev token.' });
    }
  });
}

// =========================================================================
// Global Error Handler
// =========================================================================
// Catches unhandled errors from middleware and routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);

  // Handle multer file size errors that bubble up
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large. Maximum allowed size is 5 MB.'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error.'
  });
});

// =========================================================================
// Start Server
// =========================================================================
async function startServer() {
  // Connect to MongoDB first
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 GlucoConnect Backend running on http://localhost:${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();