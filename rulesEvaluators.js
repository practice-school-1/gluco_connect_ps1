/**
 * Evaluates rule conditions against patient log data.
 * All evaluators are pure functions that return a boolean.
 */

/**
 * Evaluates rule conditions against patient log data.
 * All evaluators are pure functions that return a boolean.
 */

/**
 * Evaluates rule conditions against patient log data.
 * All evaluators are pure functions that return a boolean.
 */

const diabetesTargets = {
  type1: { fastingMax: 130, postMealMax: 180 },
  type2: { fastingMax: 126, postMealMax: 180 },
  gestational: { fastingMax: 95, postMealMax: 140 }
};

export const evaluators = {
  CRITICAL_HYPOGLYCEMIA: (currentReading) => currentReading.glucoseReading < 70,
  
  CRITICAL_HYPERGLYCEMIA: (currentReading) => currentReading.glucoseReading > 300,

  FASTING_HIGH_TREND: (currentReading, history = []) => {
    const allLogs = [...history, currentReading];
    const fastingLogs = allLogs.filter(log => log.readingType === 'fasting');
    const lastThree = fastingLogs.slice(-3);
    
    const type = currentReading.diabetesType || 'type2';
    const limit = diabetesTargets[type].fastingMax;

    return lastThree.length === 3 && lastThree.every(log => log.glucoseReading > limit);
  },

  FASTING_HYPERGLYCEMIA: (currentReading) => {
    if (currentReading.readingType !== 'fasting') return false;
    const type = currentReading.diabetesType || 'type2';
    const limits = diabetesTargets[type];
    return currentReading.glucoseReading > limits.fastingMax;
  },

  POST_MEAL_SPIKE: (currentReading) => {
    const isPostMeal = currentReading.readingType === 'post-meal' || currentReading.mealStatus === 'after meal';
    if (!isPostMeal) return false;

    const type = currentReading.diabetesType || 'type2';
    const limit = diabetesTargets[type].postMealMax;
    return currentReading.glucoseReading > limit;
  },

  OPTIMAL_FASTING: (currentReading) => {
    return currentReading.readingType === 'fasting' && 
           currentReading.glucoseReading >= 70 && 
           currentReading.glucoseReading <= 100;
  },

  OPTIMAL_POST_MEAL: (currentReading) => {
    return currentReading.readingType === 'post-meal' && 
           currentReading.glucoseReading >= 70 && 
           currentReading.glucoseReading <= 140;
  },

  RANDOM_ELEVATED: (currentReading) => {
    return currentReading.readingType === 'random' && 
           currentReading.glucoseReading > 140 && 
           currentReading.glucoseReading <= 200;
  },

  LOW_ACTIVITY_NUDGE: (currentReading) => {
    return currentReading.glucoseReading > 140 && currentReading.activityLevel === 'low';
  },

  CONSISTENT_NORMAL_REINFORCEMENT: (currentReading, history = []) => {
    const allLogs = [...history, currentReading];
    const lastThree = allLogs.slice(-3);
    return lastThree.length === 3 && lastThree.every(log => 
      log.glucoseReading >= 70 && log.glucoseReading <= 140
    );
  },

  GLUCOSE_VARIABILITY_RISK: (currentReading, history = []) => {
    const allLogs = [...history, currentReading];
    if(allLogs.length < 5) return false;

    const readings = allLogs.map(log => log.glucoseReading);
    const count = readings.length;
    
    // Calculate Mean (μ)
    const mean = readings.reduce((sum, val) => sum + val, 0) / count;
    
    // Calculate Variance & Standard Deviation (σ)
    const variance = readings.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate Coefficient of Variation (CV)
    const coefficientOfVariation = standardDeviation / mean;

    // Clinical consensus: CV > 36% indicates high variability/unstable glycemic control
    return coefficientOfVariation > 0.36;
  },

  RAPID_GLUCOSE_RISE: (currentReading, history = []) => {
    if(history.length === 0) return false;
    const previous = history[history.length - 1];
    if (!currentReading.timestamp || !previous.timestamp) return false;
    
    const glucoseDiff = currentReading.glucoseReading - previous.glucoseReading;
    const hours = (new Date(currentReading.timestamp) - new Date(previous.timestamp)) / (1000 * 60 * 60);
    
    if(hours <= 0) return false;
    return (glucoseDiff / hours) > 50;
  },

  RAPID_GLUCOSE_DROP: (currentReading, history = []) => {
    if(history.length === 0) return false;
    const previous = history[history.length - 1];
    if (!currentReading.timestamp || !previous.timestamp) return false;
    
    const glucoseDiff = previous.glucoseReading - currentReading.glucoseReading;
    const hours = (new Date(currentReading.timestamp) - new Date(previous.timestamp)) / (1000 * 60 * 60);
    
    if(hours <= 0) return false;
    return (glucoseDiff / hours) > 40;
  },

  MISSED_MEDICATION_RISK: (currentReading, history = []) => {
    const allLogs = [...history, currentReading];
    const recentLogs = allLogs.slice(-7); // Evaluate tracking window of up to 7 logs

    const missedCount = recentLogs.filter(log => log.medicationTaken === false).length;
    
    // Flags true if current state is high and there's an adherence trend failure
    return currentReading.glucoseReading > 180 && missedCount >= 3;
  },

  HIGH_GLYCEMIC_LOAD_MEAL: (currentReading) => {
    const meal = (currentReading.recentMealDescription || "").toLowerCase();
    let score = 0;

    if(meal.includes("rice")) score += 3;
    if(meal.includes("white rice")) score += 2;
    if(meal.includes("jalebi")) score += 4;
    if(meal.includes("gulab jamun")) score += 4;
    if(meal.includes("paratha")) score += 3;
    if(meal.includes("poha")) score += 2;

    if(meal.includes("salad")) score -= 2;
    if(meal.includes("dal")) score -= 1;
    if(meal.includes("paneer")) score -= 1;

    return currentReading.glucoseReading > 140 && score >= 3;
  },

  RECURRENT_HYPOGLYCEMIA: (currentReading, history = []) => {
    const allLogs = [...history, currentReading];
    const recentLogs = allLogs.slice(-5);
    const hypoCount = recentLogs.filter(log => log.glucoseReading < 70).length;
    return hypoCount >= 2;
  },

  RECURRENT_POST_MEAL_SPIKES: (currentReading, history = []) => {
    const allLogs = [...history, currentReading];
    const postMealLogs = allLogs.filter(log => log.readingType === 'post-meal' || log.mealStatus === 'after meal');
    const lastThree = postMealLogs.slice(-3);
    
    const type = currentReading.diabetesType || 'type2';
    const limit = diabetesTargets[type].postMealMax;

    return lastThree.length === 3 && lastThree.every(log => log.glucoseReading > limit);
  }
};