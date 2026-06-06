const mongoose = require('mongoose');

/**
 * Activity Schema
 * 
 * Stores normalized daily health data synced from Fitbit.
 * The compound unique index on { patientId, date } ensures that
 * running POST /fitbit/sync multiple times for the same date
 * performs an upsert rather than creating duplicate documents.
 */
const activitySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient ID is required']
  },

  // Canonical name of the wearable provider (e.g., "fitbit", "apple_health")
  provider: {
    type: String,
    default: 'fitbit',
    required: true
  },

  // Date string in "YYYY-MM-DD" format for the day this data represents
  date: {
    type: String,
    required: [true, 'Date is required'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
  },

  // --- Steps ---
  steps: {
    type: Number,
    default: 0,
    min: [0, 'Steps cannot be negative']
  },

  // --- Heart Rate ---
  heartRate: {
    restingHR: { type: Number },
    zones: [{
      name: { type: String },       // e.g. "Out of Range", "Fat Burn", "Cardio", "Peak"
      minutes: { type: Number },
      min: { type: Number },         // Lower BPM bound of this zone
      max: { type: Number }          // Upper BPM bound of this zone
    }]
  },

  // --- Sleep ---
  sleep: {
    totalMinutes: { type: Number, default: 0 },
    efficiency: { type: Number },    // Fitbit sleep efficiency score (0-100)
    quality: { 
      type: String, 
      enum: ['good', 'fair', 'poor', null],
      default: null
    },
    stages: {
      deep: { type: Number },       // Minutes in deep sleep
      light: { type: Number },      // Minutes in light sleep
      rem: { type: Number },        // Minutes in REM sleep
      wake: { type: Number }        // Minutes awake during sleep period
    }
  },

  // Raw Fitbit API response stored for debugging and future re-normalization
  rawFitbitData: {
    type: mongoose.Schema.Types.Mixed
  },

  syncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index: guarantees one document per patient per provider per day
activitySchema.index({ patientId: 1, provider: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Activity', activitySchema);
