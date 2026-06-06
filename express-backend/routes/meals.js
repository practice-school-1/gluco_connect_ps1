const express = require('express');
const authMiddleware = require('../middleware/auth');
const Meal = require('../models/Meal');
const Food = require('../models/Food');
const { uploadMealPhoto, getImageBuffer } = require('../utils/localUpload');
const { analyzeImage } = require('../utils/visionApi');
const { calculateGlycemicMetrics } = require('../utils/glycemicCalculator');

const router = express.Router();

// All meal routes require authentication
router.use(authMiddleware);

/**
 * POST /meals/photo
 *
 * Accepts a multipart form-data image upload, saves it to the local disk,
 * and returns the relative URL.
 *
 * Constraints:
 *   - Field name: "photo"
 *   - Allowed types: JPEG, PNG, WebP
 *   - Max size: 5 MB
 *
 * Response: { photoUrl: "/uploads/filename.jpg" }
 */
router.post('/photo', (req, res) => {
  const upload = uploadMealPhoto.single('photo');

  upload(req, res, (err) => {
    // Handle multer errors (file type, file size, etc.)
    if (err) {
      // Multer file size limit exceeded
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large. Maximum allowed size is 5 MB.'
        });
      }

      // Our custom file filter rejection
      if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ error: err.message });
      }

      // Any other multer or S3 error
      console.error('Upload error:', err.message);
      return res.status(500).json({
        error: 'Failed to upload photo. Please try again.'
      });
    }

    // No file was provided
    if (!req.file) {
      return res.status(400).json({
        error: 'No photo file provided. Please attach a file with the field name "photo".'
      });
    }

    res.status(201).json({
      message: 'Photo uploaded successfully.',
      // req.file.filename is provided by multer's diskStorage
      photoUrl: `/uploads/${req.file.filename}`
    });
  });
});

/**
 * POST /meals
 *
 * Creates a meal document linked to the authenticated patient.
 *
 * Body (JSON):
 *   - description (string, optional): Text description of the meal
 *   - mealType (string, required): One of "breakfast", "lunch", "dinner", "snack"
 *   - timestamp (string/Date, required): When the meal was consumed
 *   - photoUrl (string, optional): URL of an uploaded meal photo
 *
 * If photoUrl is provided, the image is sent to Google Cloud Vision API
 * for automatic label detection and Indian food matching. On Vision API
 * failure or timeout, the meal is still created with requiresManualTagging: true.
 */
router.post('/', async (req, res) => {
  try {
    const { description, mealType, timestamp, photoUrl, foodIds } = req.body;

    // Validate required fields
    if (!mealType) {
      return res.status(400).json({ error: 'mealType is required (breakfast, lunch, dinner, or snack).' });
    }
    if (!timestamp) {
      return res.status(400).json({ error: 'timestamp is required.' });
    }

    // Process foods and calculate glycemic metrics
    let resolvedFoods = [];
    if (foodIds && Array.isArray(foodIds) && foodIds.length > 0) {
      try {
        // Find all foods matching the provided IDs
        resolvedFoods = await Food.find({ _id: { $in: foodIds } });
      } catch (err) {
        console.error('⚠️ Invalid food IDs provided, skipping lookup:', err.message);
      }
    }

    const metrics = calculateGlycemicMetrics(resolvedFoods);

    // Build the meal document
    const mealData = {
      patientId: req.user._id,
      description: description || '',
      mealType,
      timestamp: new Date(timestamp),
      photoUrl: photoUrl || null,
      visionLabels: [],
      detectedFoodItems: [],
      requiresManualTagging: false,
      foodIds: resolvedFoods.map(f => f._id),
      estimatedCarbLoad: metrics.estimatedCarbLoad,
      glycemicImpact: metrics.glycemicImpact,
      foodTags: metrics.foodTags
    };

    // If a photo was provided, analyze it with Vision API
    // Strategy: Download the image from S3 via SDK (works with private buckets),
    // then pass the raw buffer to Vision API as base64 content.
    if (photoUrl) {
      console.log(`🔍 Analyzing meal photo with Vision API: ${photoUrl}`);

      try {
        // Read image from local disk using the relative URL path
        const imageBuffer = await getImageBuffer(photoUrl);

        // Analyze the image buffer — this call never throws,
        // it returns a fallback result on Vision API failure/timeout
        const visionResult = await analyzeImage(imageBuffer);

        mealData.visionLabels = visionResult.visionLabels;
        mealData.detectedFoodItems = visionResult.detectedFoodItems;
        mealData.requiresManualTagging = visionResult.requiresManualTagging;

        if (visionResult.requiresManualTagging) {
          console.log('⚠️ Vision API could not confidently identify food items. Manual tagging required.');
        } else {
          console.log(`✅ Vision API detected: ${visionResult.detectedFoodItems.join(', ')}`);
        }
      } catch (uploadError) {
        // If file reading fails, still create the meal but flag for manual tagging
        console.error('⚠️ Failed to read local image for Vision analysis:', uploadError.message);
        mealData.requiresManualTagging = true;
      }
    }

    // Save the meal to MongoDB
    const meal = await Meal.create(mealData);

    console.log(`✅ Meal logged for user ${req.user._id}: ${mealType} at ${timestamp}`);

    res.status(201).json({
      message: 'Meal logged successfully.',
      meal
    });

  } catch (error) {
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        error: 'Validation failed.',
        details: messages
      });
    }

    console.error('Meal creation error:', error.message);
    res.status(500).json({ error: 'Failed to log meal. Please try again.' });
  }
});

/**
 * GET /meals
 *
 * Retrieves a chronological list of meals for the authenticated patient.
 *
 * Optional query parameters for date range filtering:
 *   - startDate (string): ISO date or YYYY-MM-DD — filters meals on or after this date
 *   - endDate (string): ISO date or YYYY-MM-DD — filters meals on or before this date
 *
 * Examples:
 *   GET /meals
 *   GET /meals?startDate=2026-06-01&endDate=2026-06-07
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build the query filter
    const filter = { patientId: req.user._id };

    // Add date range filter if query params are provided
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set endDate to end of day to include the full day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const meals = await Meal.find(filter)
      .sort({ timestamp: -1 })      // Newest meals first
      .populate('foodIds', 'name category carbsPerServing glycemicIndex tags')
      .lean();                        // Return plain JS objects for performance

    res.json({
      message: `Found ${meals.length} meal(s).`,
      count: meals.length,
      meals
    });

  } catch (error) {
    console.error('Meal retrieval error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve meals.' });
  }
});

module.exports = router;
