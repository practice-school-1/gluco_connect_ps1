import test from 'node:test';
import assert from 'node:assert';
import { generateRecommendation } from '../services/recommendationService.js';

test('AI Engine Test Suite - GlucoConnect', async (t) => {

  await t.test('Rule 1: CRITICAL_HYPOGLYCEMIA - triggers when glucose is under 70', () => {
    const payload = {
      currentReading: {
        glucoseReading: 64,
        readingType: 'random',
        activityLevel: 'low',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T12:00:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'critical');
    assert.strictEqual(result.triggeredRule.id, 'CRITICAL_HYPOGLYCEMIA');
    assert.match(result.patientMessage, /low at 64 mg\/dL/);
  });

  await t.test('Rule 2: CRITICAL_HYPERGLYCEMIA - triggers when glucose is over 300', () => {
    const payload = {
      currentReading: {
        glucoseReading: 315,
        readingType: 'random',
        activityLevel: 'low',
        mealStatus: 'after meal',
        timestamp: '2026-06-05T12:00:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'critical');
    assert.strictEqual(result.triggeredRule.id, 'CRITICAL_HYPERGLYCEMIA');
    assert.match(result.patientMessage, /very high at 315 mg\/dL/);
  });

  await t.test('Rule 3: FASTING_HIGH_TREND - triggers when fasting glucose is consecutive high', () => {
    const payload = {
      currentReading: {
        glucoseReading: 130,
        readingType: 'fasting',
        activityLevel: 'low',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T07:00:00Z'
      },
      history: [
        {
          glucoseReading: 128,
          readingType: 'fasting',
          activityLevel: 'low',
          mealStatus: 'before meal',
          timestamp: '2026-06-03T07:00:00Z'
        },
        {
          glucoseReading: 127,
          readingType: 'fasting',
          activityLevel: 'low',
          mealStatus: 'before meal',
          timestamp: '2026-06-04T07:00:00Z'
        }
      ]
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'high');
    assert.strictEqual(result.triggeredRule.id, 'FASTING_HIGH_TREND');
  });

  await t.test('Rule 4: FASTING_HYPERGLYCEMIA - triggers when single fasting is high', () => {
    const payload = {
      currentReading: {
        glucoseReading: 135,
        readingType: 'fasting',
        activityLevel: 'medium',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T07:00:00Z'
      },
      history: [] // empty history
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'high');
    assert.strictEqual(result.triggeredRule.id, 'FASTING_HYPERGLYCEMIA');
  });

  await t.test('Rule 5: POST_MEAL_SPIKE - triggers when post-meal glucose is over 180', () => {
    const payload = {
      currentReading: {
        glucoseReading: 185,
        readingType: 'post-meal',
        activityLevel: 'low',
        mealStatus: 'after meal',
        timestamp: '2026-06-05T14:00:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'medium');
    assert.strictEqual(result.triggeredRule.id, 'POST_MEAL_SPIKE');
  });

  await t.test('Rule 6: OPTIMAL_FASTING - triggers when fasting glucose is between 70-100', () => {
    const payload = {
      currentReading: {
        glucoseReading: 88,
        readingType: 'fasting',
        activityLevel: 'low',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T07:30:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'low');
    assert.strictEqual(result.triggeredRule.id, 'OPTIMAL_FASTING');
  });

  await t.test('Rule 7: OPTIMAL_POST_MEAL - triggers when post-meal glucose is between 70-140', () => {
    const payload = {
      currentReading: {
        glucoseReading: 120,
        readingType: 'post-meal',
        activityLevel: 'medium',
        mealStatus: 'after meal',
        timestamp: '2026-06-05T14:00:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'low');
    assert.strictEqual(result.triggeredRule.id, 'OPTIMAL_POST_MEAL');
  });

  await t.test('Rule 8: RANDOM_ELEVATED - triggers when random reading is between 140-200', () => {
    const payload = {
      currentReading: {
        glucoseReading: 165,
        readingType: 'random',
        activityLevel: 'medium',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T18:00:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'low');
    assert.strictEqual(result.triggeredRule.id, 'RANDOM_ELEVATED');
  });

  await t.test('Rule 9: LOW_ACTIVITY_NUDGE - triggers when glucose > 140 and activity is low', () => {
    // Note: We test random reading that triggers LOW_ACTIVITY_NUDGE. Since it has riskLevel low,
    // we want to ensure it works correctly.
    const payload = {
      currentReading: {
        glucoseReading: 145,
        readingType: 'random',
        activityLevel: 'low',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T16:00:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.triggeredRule.id, 'LOW_ACTIVITY_NUDGE');
  });

  await t.test('Rule 10: HIGH_GLYCEMIC_LOAD_MEAL - triggers when scored high-GI meal matches after eating', () => {
    const payload = {
      currentReading: {
        glucoseReading: 155,
        readingType: 'post-meal',
        activityLevel: 'medium',
        mealStatus: 'after meal',
        timestamp: '2026-06-05T20:00:00Z',
        recentMealDescription: 'I had white rice and sweet curd'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.triggeredRule.id, 'HIGH_GLYCEMIC_LOAD_MEAL');
    assert.match(result.patientMessage, /sabzi/);
  });

  await t.test('Rule 11: CONSISTENT_NORMAL_REINFORCEMENT - triggers when last 3 readings are optimal', () => {
    const payload = {
      currentReading: {
        glucoseReading: 95,
        readingType: 'random',
        activityLevel: 'medium',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T17:00:00Z'
      },
      history: [
        {
          glucoseReading: 80,
          readingType: 'fasting',
          activityLevel: 'medium',
          mealStatus: 'before meal',
          timestamp: '2026-06-04T07:00:00Z'
        },
        {
          glucoseReading: 115,
          readingType: 'post-meal',
          activityLevel: 'high',
          mealStatus: 'after meal',
          timestamp: '2026-06-04T13:30:00Z'
        }
      ]
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.triggeredRule.id, 'CONSISTENT_NORMAL_REINFORCEMENT');
  });

  await t.test('Fallback Resolution - returns base message if no rules trigger', () => {
    // A reading of 110 mg/dL (random) with active movement does not trigger any specific alert rules
    const payload = {
      currentReading: {
        glucoseReading: 110,
        readingType: 'random',
        activityLevel: 'medium',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T12:00:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'low');
    assert.strictEqual(result.triggeredRule, null);
    assert.match(result.patientMessage, /successfully/);
  });

  await t.test('Validation Guards - rejects invalid inputs', () => {
    // OOB glucose check
    assert.throws(() => {
      generateRecommendation({
        currentReading: { glucoseReading: 15, readingType: 'random' }
      });
    }, /clinical bounds/);

    // Missing field check
    assert.throws(() => {
      generateRecommendation({});
    }, /currentReading/);

    // Invalid category check
    assert.throws(() => {
      generateRecommendation({
        currentReading: { glucoseReading: 120, readingType: 'invalid-type' }
      });
    }, /readingType/);
  });

  await t.test('Priority resolution: critical takes precedence over low', () => {
    // A reading of 60 mg/dL is low sugar (critical) and also has activityLevel 'low' (low severity nudge).
    // The engine must prioritize the critical hypoglycemia alert.
    const payload = {
      currentReading: {
        glucoseReading: 60,
        readingType: 'random',
        activityLevel: 'low',
        mealStatus: 'before meal',
        timestamp: '2026-06-05T12:00:00Z'
      }
    };
    const result = generateRecommendation(payload);
    assert.strictEqual(result.riskLevel, 'critical');
    assert.strictEqual(result.triggeredRule.id, 'CRITICAL_HYPOGLYCEMIA');
  });

});
