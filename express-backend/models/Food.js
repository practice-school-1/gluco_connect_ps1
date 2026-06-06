const mongoose = require('mongoose');

/**
 * Food Schema
 * 
 * Stores predefined nutritional data for meals, specifically 
 * focusing on carbohydrate load and Glycemic Index (GI).
 */
const foodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['grain', 'protein', 'dairy', 'vegetable', 'fruit', 'legume', 'sweet', 'beverage', 'condiment', 'snack'],
    required: true
  },
  carbsPerServing: {
    type: Number, // in grams
    required: true
  },
  glycemicIndex: {
    type: Number, // 0 - 100
    required: true
  },
  servingSize: {
    type: String, // e.g., "1 cup (200g)"
    required: true
  },
  tags: [{
    type: String, // e.g., "high-protein", "gluten-free"
    trim: true
  }],
  isIndianFood: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Food', foodSchema);
