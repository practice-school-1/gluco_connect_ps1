const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { getProvider } = require('../providers/providerRegistry');

const router = express.Router();

// =========================================================================
// Fitbit OAuth 2.0 Configuration
// =========================================================================
const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const FITBIT_API_BASE = 'https://api.fitbit.com';
const FITBIT_SCOPES = 'activity heartrate sleep';

/**
 * GET /fitbit/auth
 *
 * Redirects the user to Fitbit's OAuth 2.0 authorization page.
 * The user will be asked to grant our app access to their activity,
 * heart rate, and sleep data.
 */
router.get('/auth', (req, res) => {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const redirectUri = process.env.FITBIT_REDIRECT_URI || 'http://localhost:3000/fitbit/callback';

    const authUrl = new URL(FITBIT_AUTH_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', FITBIT_SCOPES);
    authUrl.searchParams.set('redirect_uri', redirectUri);

    res.redirect(authUrl.toString());
});

/**
 * GET /fitbit/callback
 *
 * Handles the authorization code returned by Fitbit after the user
 * approves access. Exchanges the code for access/refresh tokens
 * and stores them in the User document.
 */
router.get('/callback', async (req, res) => {
    const authorizationCode = req.query.code;

    if (!authorizationCode) {
        return res.status(400).json({
            error: 'No authorization code provided by Fitbit. The user may have denied access.'
        });
    }

    try {
        const clientId = process.env.FITBIT_CLIENT_ID;
        const clientSecret = process.env.FITBIT_CLIENT_SECRET;
        const redirectUri = process.env.FITBIT_REDIRECT_URI || 'http://localhost:3000/fitbit/callback';

        // Fitbit requires Basic Auth: Base64(client_id:client_secret)
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        // Exchange the authorization code for tokens
        const tokenResponse = await axios.post(
            FITBIT_TOKEN_URL,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: authorizationCode,
                redirect_uri: redirectUri
            }).toString(),
            {
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, refresh_token, expires_in, user_id, scope } = tokenResponse.data;

        // Calculate token expiry timestamp
        const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

        // Fetch the user's timezone from the Fitbit Profile API.
        // This is critical for calculating the correct "today" during data sync.
        // Without it, a sync at 11 PM in India (UTC+5:30) would fetch the wrong date.
        let userTimezone = 'UTC'; // Safe default
        try {
            const profileResponse = await axios.get(
                `${FITBIT_API_BASE}/1/user/-/profile.json`,
                { headers: { Authorization: `Bearer ${access_token}` } }
            );
            userTimezone = profileResponse.data?.user?.timezone || 'UTC';
            console.log(`📍 Fitbit user timezone: ${userTimezone}`);
        } catch (profileError) {
            console.warn('⚠️ Could not fetch Fitbit profile for timezone. Defaulting to UTC.');
        }

        // Upsert the user: find by Fitbit user ID, or create a new record.
        // This handles both first-time connections and re-authorizations.
        const user = await User.findOneAndUpdate(
            { 'fitbit.userId': user_id },
            {
                $set: {
                    'fitbit.userId': user_id,
                    'fitbit.accessToken': access_token,
                    'fitbit.refreshToken': refresh_token,
                    'fitbit.tokenExpiresAt': tokenExpiresAt,
                    'fitbit.scope': scope,
                    'fitbit.timezone': userTimezone
                },
                $setOnInsert: {
                    email: `${user_id}@fitbit.placeholder`,  // Placeholder until real email is provided
                    name: `Fitbit User ${user_id}`
                }
            },
            { upsert: true, new: true, runValidators: true }
        );

        console.log(`✅ Fitbit connected for user ${user._id} (Fitbit ID: ${user_id})`);

        res.json({
            message: 'Fitbit authorization successful! Tokens have been securely stored.',
            userId: user._id,
            fitbitUserId: user_id,
            scopes: scope,
            tokenExpiresAt: tokenExpiresAt.toISOString()
        });

    } catch (error) {
        const fitbitError = error.response?.data;
        console.error('Fitbit callback error:', fitbitError || error.message);

        res.status(500).json({
            error: 'Failed to exchange authorization code for Fitbit tokens.',
            details: fitbitError?.errors?.[0]?.message || error.message
        });
    }
});

/**
 * POST /fitbit/sync
 *
 * Fetches the authenticated patient's current day health data from Fitbit:
 *   - Steps (daily activity summary)
 *   - Heart rate zones (resting + zone minutes)
 *   - Sleep summary (duration, efficiency, stages)
 *
 * Fully idempotent: uses findOneAndUpdate with upsert on the
 * compound unique index (patientId + date) so running this
 * multiple times for the same date never creates duplicates.
 *
 * Protected by authMiddleware — requires a valid JWT.
 */
router.post('/sync', authMiddleware, async (req, res) => {
    try {
        const user = req.user;

        // 1. Determine today's date in YYYY-MM-DD based on the user's timezone.
        const userTimezone = user.fitbit?.timezone || 'UTC';
        const today = new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });

        // 2. Look up the Fitbit provider
        const fitbitProvider = getProvider('fitbit');

        // 3. Sync data via the provider (handles token refresh, fetching, and normalization)
        const normalizedActivity = await fitbitProvider.sync(user, today);

        // 4. Upsert into MongoDB
        const activity = await Activity.findOneAndUpdate(
            { patientId: user._id, provider: normalizedActivity.provider, date: normalizedActivity.date },
            {
                $set: {
                    steps: normalizedActivity.steps,
                    heartRate: normalizedActivity.heartRate,
                    sleep: normalizedActivity.sleep,
                    rawFitbitData: normalizedActivity.rawFitbitData,
                    syncedAt: new Date()
                }
            },
            { upsert: true, new: true, runValidators: true }
        );

        console.log(`✅ Synced Fitbit data for user ${user._id} on ${today}`);

        res.json({
            message: `Successfully synced health data for ${today}.`,
            activity: {
                date: activity.date,
                steps: activity.steps,
                heartRate: activity.heartRate,
                sleep: activity.sleep,
                syncedAt: activity.syncedAt
            }
        });

    } catch (error) {
        // --- Handle Fitbit rate limiting (HTTP 429) ---
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            console.warn(`⚠️ Fitbit rate limit hit. Retry after: ${retryAfter}s`);

            return res.status(429).json({
                error: 'Fitbit rate limit reached. Please try again in a few minutes.',
                retryAfterSeconds: parseInt(retryAfter, 10) || 60
            });
        }

        // --- Handle expired/invalid Fitbit connection ---
        if (error.message?.includes('Fitbit connection') || error.message?.includes('reconnect')) {
            return res.status(401).json({ error: error.message });
        }

        console.error('Fitbit sync error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to sync health data from Fitbit.',
            details: error.message
        });
    }
});

module.exports = router;
