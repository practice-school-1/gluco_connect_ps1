const express = require('express');
const authMiddleware = require('../middleware/auth');
const { findClosestRestaurants } = require('../utils/localLocator');

const router = express.Router();

/**
 * GET /locations/healthy-options
 * 
 * Uses a zero-cost local geolocation engine to find the closest 
 * healthy restaurants to the provided coordinates.
 * 
 * Query Params:
 *  - lat: Latitude (-90 to 90)
 *  - lng: Longitude (-180 to 180)
 */
router.get('/healthy-options', authMiddleware, (req, res) => {
  const { lat, lng } = req.query;

  // 1. Validate coordinates
  if (!lat || !lng) {
    return res.status(400).json({ 
      error: 'Missing required query parameters: "lat" and "lng" are both required.' 
    });
  }

  const numericLat = parseFloat(lat);
  const numericLng = parseFloat(lng);

  if (isNaN(numericLat) || numericLat < -90 || numericLat > 90) {
    return res.status(400).json({ error: '"lat" must be a valid number between -90 and 90.' });
  }

  if (isNaN(numericLng) || numericLng < -180 || numericLng > 180) {
    return res.status(400).json({ error: '"lng" must be a valid number between -180 and 180.' });
  }

  // 2. Perform zero-cost local lookup
  try {
    const closestOptions = findClosestRestaurants(numericLat, numericLng);

    return res.json({
      source: 'local_static_engine',
      count: closestOptions.length,
      options: closestOptions.map(opt => ({
        name: opt.name,
        distance: `${opt.distance} km`,
        rating: opt.rating,
        googleMapsUrl: opt.googleMapsUrl
      }))
    });
  } catch (error) {
    console.error('Local locator error:', error.message);
    return res.status(500).json({ error: 'Failed to process location lookup.' });
  }
});

module.exports = router;
