const restaurants = require('../data/healthyRestaurants.json');

/**
 * Calculates the great-circle distance between two points on the Earth
 * given their latitudes and longitudes using the Haversine formula.
 * 
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

/**
 * Finds the top 5 closest healthy restaurants to a given coordinate.
 * Uses a purely local, zero-cost JSON fallback matrix.
 * 
 * @param {number} userLat 
 * @param {number} userLng 
 * @returns {Array<Object>} Sorted list of top 5 closest options
 */
function findClosestRestaurants(userLat, userLng) {
  // Map over the static array, calculate distance to each, and add a maps URL
  const mappedOptions = restaurants.map(restaurant => {
    const distanceKm = haversineDistance(userLat, userLng, restaurant.lat, restaurant.lng);
    
    return {
      name: restaurant.name,
      city: restaurant.city,
      rating: restaurant.rating,
      distance: Math.round(distanceKm * 10) / 10, // Round to 1 decimal place
      googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`
    };
  });

  // Sort by distance (closest first)
  mappedOptions.sort((a, b) => a.distance - b.distance);

  // Return the top 5
  return mappedOptions.slice(0, 5);
}

module.exports = { haversineDistance, findClosestRestaurants };
