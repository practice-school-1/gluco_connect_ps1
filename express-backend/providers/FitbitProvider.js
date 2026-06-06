const axios = require('axios');
const WearableProvider = require('./WearableProvider');
const { ensureFreshToken } = require('../utils/fitbitTokenManager');

const FITBIT_API_BASE = 'https://api.fitbit.com';

class FitbitProvider extends WearableProvider {
  get name() {
    return 'fitbit';
  }

  async fetchRawData(user, date) {
    // 1. Ensure the Fitbit access token is fresh
    const accessToken = await ensureFreshToken(user);

    // 2. Fetch data from all three Fitbit endpoints in parallel
    const headers = { Authorization: `Bearer ${accessToken}` };

    try {
      const [stepsResponse, heartRateResponse, sleepResponse] = await Promise.all([
        axios.get(`${FITBIT_API_BASE}/1/user/-/activities/date/${date}.json`, { headers }),
        axios.get(`${FITBIT_API_BASE}/1/user/-/activities/heart/date/${date}/1d.json`, { headers }),
        axios.get(`${FITBIT_API_BASE}/1.2/user/-/sleep/date/${date}.json`, { headers })
      ]);

      return {
        activities: stepsResponse.data,
        heartRate: heartRateResponse.data,
        sleep: sleepResponse.data
      };
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const err = new Error('Fitbit rate limit reached.');
        err.status = 429;
        err.retryAfterSeconds = parseInt(retryAfter, 10) || 60;
        throw err;
      }
      throw error;
    }
  }

  normalize(rawData, date) {
    const rawSteps = rawData.activities;
    const rawHeartRate = rawData.heartRate;
    const rawSleep = rawData.sleep;

    // --- Steps ---
    // Handle Fitbit sandbox cases gracefully (might be empty/null)
    const steps = rawSteps?.summary?.steps || 0;

    // --- Heart Rate ---
    const heartRateData = rawHeartRate?.['activities-heart']?.[0]?.value || {};
    const restingHR = heartRateData.restingHeartRate || null;
    const zones = (heartRateData.heartRateZones || []).map(zone => ({
      name: zone.name,
      minutes: zone.minutes || 0,
      min: zone.min || 0,
      max: zone.max || 0
    }));

    // --- Sleep ---
    const sleepSummary = rawSleep?.summary || {};
    // Depending on sandbox data, sleep data might be empty array
    const mainSleep = rawSleep?.sleep?.[0] || {}; 
    const sleepStages = sleepSummary.stages || {};
    
    let sleepQuality = 'poor';
    const efficiency = mainSleep.efficiency || 0;
    if (efficiency >= 85) {
      sleepQuality = 'good';
    } else if (efficiency >= 70) {
      sleepQuality = 'fair';
    } else if (efficiency === 0) {
      sleepQuality = null; // No data
    }

    const sleepData = {
      totalMinutes: sleepSummary.totalMinutesAsleep || 0,
      efficiency: efficiency || null,
      quality: sleepQuality,
      stages: {
        deep: sleepStages.deep || 0,
        light: sleepStages.light || 0,
        rem: sleepStages.rem || 0,
        wake: sleepStages.wake || 0
      }
    };

    return {
      date,
      steps,
      heartRate: { restingHR, zones },
      sleep: sleepData
    };
  }
}

module.exports = FitbitProvider;
