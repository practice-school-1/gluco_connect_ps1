/**
 * Glycemic Calculator
 * 
 * Computes the total estimated carb load and an overall glycemic impact
 * category (low, medium, high) based on an array of Food objects.
 */

/**
 * Calculate metrics for a meal based on its food components.
 * 
 * @param {Array<Object>} foods - Array of populated Food documents
 * @returns {Object} { estimatedCarbLoad, glycemicImpact, foodTags }
 */
function calculateGlycemicMetrics(foods) {
  // Edge case: No foods provided
  if (!foods || foods.length === 0) {
    return {
      estimatedCarbLoad: 0,
      glycemicImpact: 'low',
      foodTags: []
    };
  }

  let totalCarbs = 0;
  let totalWeightedGI = 0;
  const tagSet = new Set();

  foods.forEach(food => {
    // Collect tags, deduplicating them using a Set
    if (Array.isArray(food.tags)) {
      food.tags.forEach(tag => tagSet.add(tag));
    }

    // Sum carbohydrates
    const carbs = Number(food.carbsPerServing) || 0;
    const gi = Number(food.glycemicIndex) || 0;

    totalCarbs += carbs;
    
    // Weight the GI by the carbohydrate amount of that food
    // (A food with 0 carbs has zero impact on the meal's overall GI)
    totalWeightedGI += (gi * carbs);
  });

  // Calculate the weighted average Glycemic Index of the meal
  let averageGI = 0;
  if (totalCarbs > 0) {
    averageGI = totalWeightedGI / totalCarbs;
  }

  // Determine the overall Glycemic Impact category
  // Standard clinical GI boundaries: Low (<= 55), Medium (56-69), High (>= 70)
  let glycemicImpact = 'low';
  if (averageGI >= 70) {
    glycemicImpact = 'high';
  } else if (averageGI >= 56) {
    glycemicImpact = 'medium';
  }

  return {
    estimatedCarbLoad: Math.round(totalCarbs * 10) / 10, // Round to 1 decimal place
    glycemicImpact,
    foodTags: Array.from(tagSet)
  };
}

module.exports = { calculateGlycemicMetrics };
