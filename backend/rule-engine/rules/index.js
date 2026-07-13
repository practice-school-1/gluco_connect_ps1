import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluators } from './rulesEvaluators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rulesPath = path.join(__dirname, 'rules.json');
const rawRulesConfig = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

export const rules = rawRulesConfig
  .filter(rule => rule.enabled)
  .map(rule => {
    const evaluator = evaluators[rule.id];
    return {
      ...rule,
      evaluate: evaluator || (() => false)
    };
  });

const severityScore = { critical: 100, high: 40, medium: 20, low: 10 };
const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Deterministic Rule Confidence Engine
 * Evaluates signal extremity and historical timeline depth to determine a score from 0.00 to 1.00.
 */
const calculateRuleConfidence = (ruleId, currentReading, history) => {
  let baseConfidence = 0.85;
  const totalDataPoints = history.length + 1;

  const historyDependentRules = [
    'FASTING_HIGH_TREND', 'GLUCOSE_VARIABILITY_RISK', 
    'RECURRENT_HYPOGLYCEMIA', 'RECURRENT_POST_MEAL_SPIKES', 'MISSED_MEDICATION_RISK'
  ];
  
  if (historyDependentRules.includes(ruleId)) {
    baseConfidence = Math.min(0.70 + (totalDataPoints * 0.04), 0.98);
  }

  if (ruleId === 'CRITICAL_HYPERGLYCEMIA' && currentReading.glucoseReading > 360) baseConfidence = 0.99;
  if (ruleId === 'CRITICAL_HYPOGLYCEMIA' && currentReading.glucoseReading < 50) baseConfidence = 0.99;

  return parseFloat(baseConfidence.toFixed(2));
};

/**
 * Main Engine Entry Point
 */
export const analyzePatientData = (currentReading, history = []) => {
  const triggeredRules = rules.filter(rule => rule.evaluate(currentReading, history));

  const rawRiskScore = triggeredRules.reduce((sum, rule) => sum + (severityScore[rule.severity] || 0), 0);
  const riskScore = Math.min(rawRiskScore, 100); // 0-100 Clinical Scale Cap

  let riskLevel = "low";
  if (riskScore >= 100) riskLevel = "critical";
  else if (riskScore >= 40) riskLevel = "high";
  else if (riskScore >= 20) riskLevel = "medium";

  const sortedTriggered = [...triggeredRules].sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

  const primaryRisk = sortedTriggered.length > 0 ? sortedTriggered[0].id : null;
  const secondaryRisks = sortedTriggered.slice(1).map(rule => rule.id);

  // Mapped transparently with explicit ruleConfidenceScore
  const triggeredRulesDetailed = sortedTriggered.map(rule => ({
    rule: rule.id,
    description: rule.description,
    severity: rule.severity,
    clinicalAction: rule.clinicalAction,
    patientMessage: (rule.patientMessageTemplate || '').replace(/\{value\}/g, currentReading.glucoseReading),
    ruleConfidenceScore: calculateRuleConfidence(rule.id, currentReading, history)
  }));

  return {
    riskScore,
    riskLevel,
    primaryRisk,
    secondaryRisks,
    triggeredRules: triggeredRulesDetailed,
    alerts: sortedTriggered.map(rule => rule.patientMessageTemplate)
  };
};