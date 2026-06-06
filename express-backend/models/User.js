const mongoose = require('mongoose');

/**
 * User Schema
 * 
 * Stores patient identity and securely persists Fitbit OAuth 2.0 tokens.
 * The `fitbit.tokenExpiresAt` field is used by the token manager utility
 * to automatically refresh expired tokens before making Fitbit API calls.
 */
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },

  name: {
    type: String,
    trim: true
  },

  // Fitbit OAuth 2.0 credentials — populated after the user completes
  // the authorization flow at GET /fitbit/auth → GET /fitbit/callback
  fitbit: {
    userId: { type: String },                  // Fitbit's internal user ID
    accessToken: { type: String },             // Short-lived access token
    refreshToken: { type: String },            // Long-lived refresh token for rotation
    tokenExpiresAt: { type: Date },            // Exact expiry timestamp
    scope: { type: String },                   // Granted scopes (e.g. "activity heartrate sleep")
    timezone: { type: String }                 // IANA timezone from Fitbit profile (e.g. "Asia/Kolkata")
  }
}, {
  timestamps: true   // Adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('User', userSchema);
