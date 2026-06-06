/**
 * Abstract Base Class for all Wearable Providers
 * 
 * Ensures that any future provider (Apple Health, Google Fit, etc.)
 * implements the same interface and returns a normalized ActivityRecord.
 */
class WearableProvider {
  /**
   * The canonical name of the provider (e.g., 'fitbit', 'apple_health')
   * @returns {string}
   */
  get name() {
    throw new Error('Provider must implement getter "name"');
  }

  /**
   * Fetches raw data from the provider's API.
   * 
   * @param {Object} user - The Mongoose User document
   * @param {string} date - Date string in 'YYYY-MM-DD' format
   * @returns {Promise<Object>} Raw API response data
   */
  async fetchRawData(user, date) {
    throw new Error('Provider must implement method "fetchRawData"');
  }

  /**
   * Normalizes raw API data into the unified ActivityRecord structure.
   * 
   * @param {Object} rawData - Data returned by fetchRawData
   * @param {string} date - Date string in 'YYYY-MM-DD' format
   * @returns {Object} Normalized ActivityRecord
   */
  normalize(rawData, date) {
    throw new Error('Provider must implement method "normalize"');
  }

  /**
   * Orchestrates fetching and normalizing. 
   * This is the primary method called by the routes.
   * 
   * @param {Object} user - The Mongoose User document
   * @param {string} date - Date string in 'YYYY-MM-DD' format
   * @returns {Promise<Object>} The unified ActivityRecord
   */
  async sync(user, date) {
    const rawData = await this.fetchRawData(user, date);
    const normalized = this.normalize(rawData, date);
    
    // Attach the provider name and raw data to the final record
    return {
      provider: this.name,
      ...normalized,
      rawFitbitData: rawData // Keeping legacy name for schema compatibility if needed, or change to rawData
    };
  }
}

module.exports = WearableProvider;
