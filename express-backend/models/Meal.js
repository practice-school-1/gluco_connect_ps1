const mongoose = require('mongoose');

/**
 * Meal Schema
 * 
 * Stores meal entries linked to a patient, with optional photo analysis
 * via Google Cloud Vision API. When Vision API returns low-confidence
 * or generic labels, `requiresManualTagging` is set to true so the
 * frontend can prompt the user to select from a predefined food list.
 */
const mealSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient ID is required']
  },

  description: {
    type: String,
    trim: true
  },

  mealType: {
    type: String,
    enum: {
      values: ['breakfast', 'lunch', 'dinner', 'snack'],
      message: 'mealType must be one of: breakfast, lunch, dinner, snack'
    },
    required: [true, 'Meal type is required']
  },

  timestamp: {
    type: Date,
    required: [true, 'Timestamp is required']
  },

  // URL of the uploaded meal photo in S3/R2 (or local relative path)
  photoUrl: {
    type: String
  },

  // Linked foods from the predefined database
  foodIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Food'
  }],

  // Total estimated carbs for this meal based on the linked foods
  estimatedCarbLoad: {
    type: Number,
    default: 0
  },

  // Categorical impact based on the weighted average Glycemic Index
  glycemicImpact: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },

  // Aggregated tags from all linked foods (e.g. "vegetarian", "high-protein")
  foodTags: [{
    type: String
  }],

  // Raw labels returned by Google Cloud Vision API
  visionLabels: [{
    label: { type: String },
    confidence: { type: Number }       // Score between 0.0 and 1.0
  }],

  // Indian food items detected by matching Vision labels against the predefined list
  detectedFoodItems: [{
    type: String
  }],

  // Flag for the frontend: if true, prompt user to manually select food items
  // Set to true when Vision API fails, times out, or returns only generic labels
  requiresManualTagging: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient patient-specific queries with date range filtering
mealSchema.index({ patientId: 1, timestamp: -1 });

module.exports = mongoose.model('Meal', mealSchema);
