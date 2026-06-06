const axios = require('axios');
const User = require('../models/User');

/**
 * Fitbit Token Manager
 * 
 * Checks whether the user's Fitbit access token has expired and
 * automatically refreshes it using the refresh token. This must
 * be called before every Fitbit API request.
 * 
 * Flow:
 *   1. Check if tokenExpiresAt < now (with a 5-minute buffer)
 *   2. If expired, POST to Fitbit's /oauth2/token with grant_type=refresh_token
 *   3. Save the new tokens to the User document in MongoDB
 *   4. Return the fresh access token
 * 
 * @param {Object} user - Mongoose User document with fitbit credentials
 * @returns {string} A valid (possibly refreshed) access token
 * @throws {Error} If refresh fails (e.g., token revoked by user)
 */
async function ensureFreshToken(user) {
  // If no Fitbit credentials exist, the user hasn't connected Fitbit yet
  if (!user.fitbit || !user.fitbit.accessToken) {
    throw new Error('No Fitbit connection found. Please connect your Fitbit account first.');
  }

  // Check if the token is still valid (with a 5-minute safety buffer)
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  const now = new Date();
  const expiresAt = new Date(user.fitbit.tokenExpiresAt);

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    // Token is still valid — return it directly
    return user.fitbit.accessToken;
  }

  // --- Token is expired or about to expire — refresh it ---
  console.log(`🔄 Refreshing Fitbit token for user ${user._id}...`);

  try {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;

    // Fitbit requires Basic Auth: Base64(client_id:client_secret)
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await axios.post(
      'https://api.fitbit.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.fitbit.refreshToken
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Calculate the new expiry timestamp
    const newExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Persist the refreshed tokens in MongoDB
    await User.findByIdAndUpdate(user._id, {
      'fitbit.accessToken': access_token,
      'fitbit.refreshToken': refresh_token,
      'fitbit.tokenExpiresAt': newExpiresAt
    });

    // Also update the in-memory user object so the caller gets the fresh token
    user.fitbit.accessToken = access_token;
    user.fitbit.refreshToken = refresh_token;
    user.fitbit.tokenExpiresAt = newExpiresAt;

    console.log(`✅ Fitbit token refreshed successfully for user ${user._id}`);
    return access_token;

  } catch (error) {
    // If the refresh token itself is invalid (revoked, expired), the user must re-authorize
    const status = error.response?.status;
    const fitbitError = error.response?.data;

    if (status === 401 || status === 400) {
      // Clear the stored tokens since they are no longer valid
      await User.findByIdAndUpdate(user._id, {
        'fitbit.accessToken': null,
        'fitbit.refreshToken': null,
        'fitbit.tokenExpiresAt': null
      });

      throw new Error(
        'Fitbit authorization has been revoked or expired. Please reconnect your Fitbit account at GET /fitbit/auth.'
      );
    }

    console.error('Fitbit token refresh error:', fitbitError || error.message);
    throw new Error('Failed to refresh Fitbit token. Please try again later.');
  }
}

module.exports = { ensureFreshToken };
