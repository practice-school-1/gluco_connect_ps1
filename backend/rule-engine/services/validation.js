// Input validation helper for blood sugar, enums, BP, and history.
// We clean and sort logs here so rule scripts can process them easily.
export function validateInput(payload) {
  if (!payload || !payload.currentReading) {
    throw new Error('Invalid input payload: "currentReading" is required.');
  }

  const { currentReading, history = [] } = payload;
  const {
    glucoseReading,
    readingType,
    activityLevel,
    mealStatus,
    timestamp,
    systolicBp,
    diastolicBp,
  } = currentReading;

  // 1. Check blood glucose range (20 to 600 mg/dL)
  if (typeof glucoseReading !== 'number' || isNaN(glucoseReading)) {
    throw new Error('Invalid input: "glucoseReading" must be a number.');
  }
  if (glucoseReading < 20 || glucoseReading > 600) {
    throw new Error(
      'Invalid input: "glucoseReading" must be within clinical bounds (20 – 600 mg/dL).'
    );
  }

  // 2. Validate enum fields (optional parameters)
  const validReadingTypes = ['fasting', 'pre_meal', 'pre-meal', 'post_meal', 'post-meal', 'random', 'bedtime'];
  if (readingType && !validReadingTypes.includes(readingType)) {
    throw new Error(
      `Invalid input: "readingType" must be one of: ${validReadingTypes.join(', ')}.`
    );
  }

  const validMealStatuses = ['before meal', 'after meal'];
  if (mealStatus && !validMealStatuses.includes(mealStatus)) {
    throw new Error(
      `Invalid input: "mealStatus" must be one of: ${validMealStatuses.join(', ')}.`
    );
  }

  const validActivityLevels = ['low', 'medium', 'high'];
  if (activityLevel && !validActivityLevels.includes(activityLevel)) {
    throw new Error(
      `Invalid input: "activityLevel" must be one of: ${validActivityLevels.join(', ')}.`
    );
  }

  // 3. Make sure BP values make sense if they were provided
  if (systolicBp !== undefined && systolicBp !== null) {
    if (typeof systolicBp !== 'number' || systolicBp < 50 || systolicBp > 300) {
      throw new Error(
        'Invalid input: "systolicBp" must be a number between 50 and 300 mmHg.'
      );
    }
  }
  if (diastolicBp !== undefined && diastolicBp !== null) {
    if (typeof diastolicBp !== 'number' || diastolicBp < 30 || diastolicBp > 200) {
      throw new Error(
        'Invalid input: "diastolicBp" must be a number between 30 and 200 mmHg.'
      );
    }
  }

  // 4. Validate timestamp format
  if (timestamp) {
    const parsedDate = new Date(timestamp);
    if (isNaN(parsedDate.getTime())) {
      throw new Error(
        'Invalid input: "timestamp" must be a valid ISO 8601 date string.'
      );
    }
  }

  // 5. Clean up historical data logs
  // Filters out duplicates, bad values, and sorts them oldest-to-newest.
  // This lets rule evaluators safely check previous entries via index.
  const seenTimestamps = new Set();

  // Exclude current reading's timestamp from history so we don't count it twice
  if (timestamp) {
    seenTimestamps.add(timestamp);
  }

  const cleanedHistory = [];

  for (const log of history) {
    if (!log || typeof log.glucoseReading !== 'number') continue;
    if (log.glucoseReading < 20 || log.glucoseReading > 600) continue;

    const logTime = log.timestamp || null;
    if (logTime && seenTimestamps.has(logTime)) continue;
    if (logTime) seenTimestamps.add(logTime);

    cleanedHistory.push(log);
  }

  // Sort (oldest first, latest last) so evaluators can run slice checks
  cleanedHistory.sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );

  return cleanedHistory;
}
