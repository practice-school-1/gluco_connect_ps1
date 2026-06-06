const FitbitProvider = require('./FitbitProvider');

/**
 * Registry for Wearable Providers
 * 
 * Allows dynamic lookup of providers by name.
 */
const providers = {
  fitbit: new FitbitProvider()
  // Future providers (e.g., apple_health, google_fit) can be added here
};

/**
 * Get a registered wearable provider by its canonical name.
 * 
 * @param {string} name - The provider name
 * @returns {import('./WearableProvider')}
 */
function getProvider(name) {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Wearable provider '${name}' is not registered.`);
  }
  return provider;
}

module.exports = { getProvider, providers };
