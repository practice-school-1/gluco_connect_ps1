// Feature Engineering helper
// Computes metrics like Time-In-Range, CV, trend line slopes, and PPG spikes.
// Uses clinical fallbacks if the patient does not have enough logs yet.
export function computeFeatures(payload, cleanedHistory) {
  const { currentReading, profile = {} } = payload;
  const allLogs = [...cleanedHistory, currentReading];

  // Target range bounds: use profile configs, fallback to 70-140 mg/dL
  const targetMin = typeof profile.targetGlucoseMin === 'number' ? profile.targetGlucoseMin : 70;
  const targetMax = typeof profile.targetGlucoseMax === 'number' ? profile.targetGlucoseMax : 140;

  // 1. Calculate TIR, TAR, TBR percentages
  const glucoseValues = allLogs
    .map(log => log.glucoseReading)
    .filter(val => typeof val === 'number');

  let tirPercent = 0;
  let tarPercent = 0;
  let tbrPercent = 0;

  if (glucoseValues.length > 0) {
    const total = glucoseValues.length;
    const inRange   = glucoseValues.filter(v => v >= targetMin && v <= targetMax).length;
    const aboveRange = glucoseValues.filter(v => v > targetMax).length;
    const belowRange = glucoseValues.filter(v => v < targetMin).length;

    tirPercent = parseFloat(((inRange   / total) * 100).toFixed(1));
    tarPercent = parseFloat(((aboveRange / total) * 100).toFixed(1));
    tbrPercent = parseFloat(((belowRange / total) * 100).toFixed(1));
  }

  // 2. Glycemic Variability (%CV)
  // Needs at least 3 readings, evaluated on the last 10 entries.
  const lastTenValues = allLogs.slice(-10)
    .map(log => log.glucoseReading)
    .filter(val => typeof val === 'number');

  let cvPercent = 25.0; // Clinical default for normal variability

  if (lastTenValues.length >= 3) {
    const mean = lastTenValues.reduce((s, v) => s + v, 0) / lastTenValues.length;
    const variance = lastTenValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0)
      / lastTenValues.length;
    cvPercent = mean > 0
      ? parseFloat(((Math.sqrt(variance) / mean) * 100).toFixed(2))
      : 25.0;
  }

  // 3. Fasting Glucose Trend (mean value across all fasting records)
  const fastingLogs = allLogs.filter(log => log.readingType === 'fasting');
  const fpgTrend = fastingLogs.length > 0
    ? parseFloat(
        (fastingLogs.reduce((s, log) => s + log.glucoseReading, 0) / fastingLogs.length)
          .toFixed(1)
      )
    : 140.0; // LANDMARC Indian T2D mean baseline

  // 4. Fasting Glucose Slope (Direction over last 3 fasting logs)
  // Can be 'rising', 'falling', 'stable', or 'insufficient_data'
  let glucoseTrend = 'insufficient_data';

  if (fastingLogs.length >= 3) {
    const recent = fastingLogs.slice(-3);
    const firstVal = recent[0].glucoseReading;
    const lastVal  = recent[recent.length - 1].glucoseReading;
    const delta    = lastVal - firstVal;

    if (delta > 10)      glucoseTrend = 'rising';
    else if (delta < -10) glucoseTrend = 'falling';
    else                  glucoseTrend = 'stable';
  }

  // 5. PPG Delta (Difference between post-meal reading and pre-meal baseline)
  // We only run this calculation if this is a post-meal reading.
  let ppgDelta = null;

  const isPostMeal = currentReading.readingType === 'post-meal'
    || currentReading.readingType === 'post_meal'
    || currentReading.mealStatus === 'after meal';

  if (isPostMeal && typeof currentReading.glucoseReading === 'number') {
    const currentTime = new Date(currentReading.timestamp || Date.now());

    // Fetch any pre-meal or fasting log within 12 hours from target timestamp
    const preMealLogs = cleanedHistory.filter(log => {
      const isFastingOrPreMeal = log.readingType === 'fasting'
        || log.readingType === 'pre_meal'
        || log.readingType === 'pre-meal'
        || log.mealStatus === 'before meal';

      if (!isFastingOrPreMeal) return false;

      const logTime = new Date(log.timestamp || 0);
      const diffHours = (currentTime - logTime) / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 12;
    });

    if (preMealLogs.length > 0) {
      const nearestPreMeal = preMealLogs[preMealLogs.length - 1];
      ppgDelta = parseFloat(
        Math.max(0, currentReading.glucoseReading - nearestPreMeal.glucoseReading).toFixed(1)
      );
    }
  }

  // 6. Logging Adherence rate
  // Percentage of daily compliance since first logged record.
  let adherenceRate = 85.0; // Sensible default

  if (cleanedHistory.length >= 2) {
    const firstLogTime  = new Date(cleanedHistory[0].timestamp || 0);
    const lastLogTime   = new Date(currentReading.timestamp || Date.now());
    const daysElapsed   = Math.max(1, (lastLogTime - firstLogTime) / (1000 * 60 * 60 * 24));
    adherenceRate = parseFloat(
      Math.min(100, Math.round((allLogs.length / daysElapsed) * 100)).toFixed(1)
    );
  }

  // 7. Estimating steps from activity label if actual steps not reported
  const stepEstimates = { low: 2000, medium: 5500, high: 10000 };
  const avgSteps = typeof currentReading.steps === 'number'
    ? currentReading.steps
    : (stepEstimates[currentReading.activityLevel] || 5500);

  return {
    tirPercent,
    tarPercent,
    tbrPercent,
    cvPercent,
    fpgTrend,
    glucoseTrend,
    ppgDelta,
    adherenceRate,
    avgSteps,
    totalReadings: allLogs.length,
    targetMin,
    targetMax,
  };
}
