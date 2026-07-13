import { rules, analyzePatientData } from '../rules/index.js';
import { validateInput } from './validation.js';
import { computeFeatures } from './featureEngineer.js';

// --- Safety Check ---
// Checks the text for any phrases advising medication titration or dosages.
// If found, replaces it with a generic safe warning advising the patient to consult their doctor.
export function applySafetyFilter(text) {
  if (!text || typeof text !== 'string') return text;

  const titrationPatterns = [
    /adjust\s+(your\s+)?(insulin|medication|dosage|dose|units)/i,
    /increase\s+(your\s+)?(insulin|medication|dosage|dose|units)/i,
    /decrease\s+(your\s+)?(insulin|medication|dosage|dose|units)/i,
    /titrate\s+(your\s+)?(insulin|medication|dosage|dose|units)/i,
    /change\s+(your\s+)?(insulin|medication|dosage|dose|units)/i,
    /stop\s+(taking|your\s+)?(insulin|medication|dosage|dose|units)/i,
    /start\s+(taking|your\s+)?(insulin|medication|dosage|dose|units)/i,
    /prescribe\s+/i,
    /inject\s+\d+\s*units/i,
  ];

  const isUnsafe = titrationPatterns.some(pattern => pattern.test(text));
  if (isUnsafe) {
    return 'Please discuss any medication reviews, insulin adjustments, or dosage changes with your physician or endocrinologist. Do not self-adjust medications.';
  }
  return text;
}

// --- Severity Precedence ---
// Helper weights to sort severity levels from critical (highest) to low (lowest)

// --- Generate Recommendation ---
// Main function that handles validation, feature calculation, rules check,
// critical overrides, and safety filters.
export function generateRecommendation(payload) {

  // Step 1: Check inputs and format history
  const cleanedHistory = validateInput(payload);
  const { currentReading } = payload;

  // Step 2: Compute TIR, CV, trends, etc.
  const computedFeatures = computeFeatures(payload, cleanedHistory);

  // Step 3: Run the rule engine
  const engineOutput = analyzePatientData(currentReading, cleanedHistory);

  const {
    riskScore,
    riskLevel,
    primaryRisk,
    secondaryRisks,
    triggeredRules: triggeredRulesDetailed,
  } = engineOutput;

  // Step 4: Quick escape for critical issues (like severe low blood sugar)
  // Don't wait for other calculations, output safety warning immediately.
  if (riskLevel === 'critical' && primaryRisk) {
    const criticalRule = triggeredRulesDetailed.find(r => r.rule === primaryRisk);

    return {
      riskLevel:        'critical',
      riskScore,
      recommendation:   applySafetyFilter(criticalRule?.clinicalAction ?? ''),
      patientMessage:   applySafetyFilter(criticalRule?.patientMessage ?? ''),
      triggeredRule: criticalRule ? {
        id:                  criticalRule.rule,
        description:         criticalRule.description,
        severity:            'critical',
        ruleConfidenceScore: criticalRule.ruleConfidenceScore,
      } : null,
      secondaryRisks,
      computedFeatures,
      engineVersion: '2.0.0',
      timestamp:     new Date().toISOString(),
    };
  }

  // Step 5: Default low-risk output if no rules are hit
  if (!primaryRisk) {
    return {
      riskLevel:        'low',
      riskScore:        0,
      recommendation:   'Continue tracking blood sugar as scheduled. Regular checks help optimise treatment efficacy.',
      patientMessage:   'Your blood sugar reading is logged successfully. Keep up the consistent monitoring!',
      triggeredRule:    null,
      secondaryRisks:   [],
      computedFeatures,
      engineVersion:    '2.0.0',
      timestamp:        new Date().toISOString(),
    };
  }

  // Step 6: Otherwise format the primary triggered rule output
  const selectedRule = triggeredRulesDetailed.find(r => r.rule === primaryRisk);

  return {
    riskLevel,
    riskScore,
    recommendation:   applySafetyFilter(selectedRule?.clinicalAction ?? ''),
    patientMessage:   applySafetyFilter(selectedRule?.patientMessage ?? ''),
    triggeredRule: selectedRule ? {
      id:                  selectedRule.rule,
      description:         selectedRule.description,
      severity:            riskLevel,
      ruleConfidenceScore: selectedRule.ruleConfidenceScore,
    } : null,
    secondaryRisks,
    computedFeatures,
    engineVersion: '2.0.0',
    timestamp:     new Date().toISOString(),
  };
}
