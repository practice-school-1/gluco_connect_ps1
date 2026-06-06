const vision = require('@google-cloud/vision');

/**
 * Google Cloud Vision API Utility
 * 
 * Analyzes meal photos using label detection and matches results
 * against a predefined list of common Indian foods.
 * 
 * Image Input: Accepts a Buffer (base64-encoded internally), NOT a URL.
 * This allows the Vision API to work with private S3/R2 buckets — the
 * image is downloaded via the S3 SDK and passed as raw bytes.
 * 
 * Fallback Logic:
 *   1. If Vision API times out (10s) or errors → requiresManualTagging: true
 *   2. If all labels are generic ("food", "dish", etc.) → requiresManualTagging: true
 *   3. If no Indian food matches are found → requiresManualTagging: true
 *   4. If matched Indian food labels all have confidence < 0.70 → requiresManualTagging: true
 */

// Initialize the Vision API client
// Credentials are loaded from the GOOGLE_APPLICATION_CREDENTIALS env variable
const client = new vision.ImageAnnotatorClient();

// Minimum confidence score for an Indian food match to be accepted.
// Labels below this threshold are discarded to prevent false positives
// (e.g., labeling a bowl of soup as "dal" with 40% confidence).
const MIN_FOOD_CONFIDENCE = 0.70;

// Predefined list of common Indian foods for label matching
const INDIAN_FOODS = [
  'dal', 'daal', 'lentil', 'lentils',
  'roti', 'chapati', 'chapatti', 'naan', 'nan', 'paratha', 'puri', 'poori', 'kulcha',
  'biryani', 'biriyani', 'pulao', 'pulav', 'khichdi',
  'dosa', 'dosai', 'idli', 'idly', 'vada', 'medu vada', 'uttapam',
  'sambar', 'sambhar', 'rasam',
  'paneer', 'palak paneer', 'butter paneer', 'shahi paneer',
  'curry', 'masala', 'tikka', 'tikka masala', 'tandoori', 'tandoor',
  'butter chicken', 'chicken tikka', 'chicken curry',
  'raita', 'chutney', 'pickle', 'achaar',
  'samosa', 'pakora', 'pakoda', 'bhaji', 'bhajia', 'kachori',
  'kheer', 'gulab jamun', 'jalebi', 'rasgulla', 'barfi', 'ladoo', 'laddu', 'halwa',
  'chaat', 'pani puri', 'gol gappa', 'bhel puri', 'sev puri',
  'thali', 'dal makhani', 'rajma', 'chole', 'chana masala',
  'aloo', 'gobi', 'bhindi', 'baingan', 'palak',
  'korma', 'vindaloo', 'rogan josh', 'keema',
  'pav bhaji', 'misal pav', 'vada pav',
  'uttapam', 'appam', 'puttu', 'upma', 'poha', 'dhokla'
];

// Generic/useless labels that Vision API often returns for food photos
const GENERIC_LABELS = [
  'food', 'dish', 'cuisine', 'meal', 'recipe', 'ingredient',
  'produce', 'tableware', 'plate', 'bowl', 'table',
  'comfort food', 'staple food', 'fast food', 'street food',
  'vegetarian food', 'indian cuisine', 'asian food'
];

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve
 * within the specified duration, the wrapper rejects.
 * 
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} The original promise result or a timeout rejection
 */
function withTimeout(promise, timeoutMs) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Vision API timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]);
}

/**
 * Analyze a meal image using Google Cloud Vision API.
 * 
 * Accepts a Buffer (image bytes) and sends it as base64-encoded content.
 * This approach works with private S3/R2 buckets — no public URL needed.
 * 
 * @param {Buffer} imageBuffer - Image data as a Node.js Buffer
 * @returns {Object} Analysis result:
 *   - visionLabels: Array of { label, confidence }
 *   - detectedFoodItems: Array of matched Indian food names (confidence ≥ 0.70)
 *   - requiresManualTagging: Boolean flag
 */
async function analyzeImage(imageBuffer) {
  // Default fallback result — used when Vision API fails, times out, or is disabled
  const fallbackResult = {
    visionLabels: [],
    detectedFoodItems: [],
    requiresManualTagging: true
  };

  // Skip Vision API entirely if disabled in environment
  // This helps conserve the 1,000 free monthly requests during dev/sandbox
  if (process.env.ENABLE_VISION_API === 'false') {
    console.log('ℹ️ Vision API is disabled (ENABLE_VISION_API=false). Falling back to manual tagging.');
    return fallbackResult;
  }

  try {
    // Convert Buffer to base64 string for the Vision API
    const base64Content = imageBuffer.toString('base64');

    // Call Vision API with a 10-second timeout
    // Uses `content` (base64) instead of `source.imageUri` so the image
    // does NOT need to be publicly accessible
    const [result] = await withTimeout(
      client.labelDetection({ image: { content: base64Content } }),
      10000 // 10 seconds
    );

    const labels = result.labelAnnotations || [];

    if (labels.length === 0) {
      console.log('Vision API returned no labels for the image.');
      return fallbackResult;
    }

    // Map labels to our format
    const visionLabels = labels.map(label => ({
      label: label.description,
      confidence: Math.round(label.score * 100) / 100 // Round to 2 decimal places
    }));

    // Match labels against Indian food list (case-insensitive)
    // ONLY accept matches where the label's confidence ≥ MIN_FOOD_CONFIDENCE (0.70)
    // to prevent false positives like labeling soup as "dal" at 40% confidence
    const detectedFoodItems = [];
    for (const labelObj of visionLabels) {
      // Skip labels below the confidence threshold
      if (labelObj.confidence < MIN_FOOD_CONFIDENCE) {
        continue;
      }

      const labelLower = labelObj.label.toLowerCase();
      for (const food of INDIAN_FOODS) {
        if (labelLower.includes(food) || food.includes(labelLower)) {
          if (!detectedFoodItems.includes(food)) {
            detectedFoodItems.push(food);
          }
        }
      }
    }

    // Determine if manual tagging is required
    let requiresManualTagging = false;

    // Case 1: No Indian food items detected (or all below confidence threshold)
    if (detectedFoodItems.length === 0) {
      requiresManualTagging = true;
    }

    // Case 2: All labels are generic/useless
    const nonGenericLabels = visionLabels.filter(
      l => !GENERIC_LABELS.includes(l.label.toLowerCase())
    );
    if (nonGenericLabels.length === 0) {
      requiresManualTagging = true;
    }

    // Case 3: All non-generic labels have low confidence (< 0.70)
    const highConfidenceLabels = nonGenericLabels.filter(l => l.confidence >= MIN_FOOD_CONFIDENCE);
    if (highConfidenceLabels.length === 0 && detectedFoodItems.length === 0) {
      requiresManualTagging = true;
    }

    return {
      visionLabels,
      detectedFoodItems,
      requiresManualTagging
    };

  } catch (error) {
    // Vision API timeout or any other error — gracefully fall back
    console.error('Vision API error:', error.message);
    return fallbackResult;
  }
}

module.exports = { analyzeImage, INDIAN_FOODS, MIN_FOOD_CONFIDENCE };
