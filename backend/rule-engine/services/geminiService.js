// Gemini Service
// This file translates rule outputs into user-friendly explanations.
// Called only when a user explicitly requests an explanation (button clicks).
// We check for cached records first to avoid making redundant network calls.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- Environment variables ---

// Load .env configs safely if available
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (_e) {
  // Dotenv is optional — env vars may be injected by the host process
}

const apiKey = process.env.GEMINI_API_KEY;

// --- Lazy Client Init ---

let _geminiClient = null;

// Helper function to build a cached GoogleGenAI instance.
// Returns null if the API key is not configured.
async function getGeminiClient() {
  if (_geminiClient) return _geminiClient;

  if (!apiKey || apiKey === 'YOUR_KEY_HERE' || apiKey.trim() === '') {
    return null;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    _geminiClient = new GoogleGenAI({ apiKey });
    return _geminiClient;
  } catch (_e) {
    console.warn(
      '[GeminiService] @google/genai package is not installed — ' +
      'falling back to template responses. Run: npm install @google/genai'
    );
    return null;
  }
}

// --- Prompt File Loader ---

const promptsDir = path.join(__dirname, '..', 'prompts');

// Helper to load templates from prompts folder.
// Uses a default fallback string if reading file fails.
function loadPrompt(fileName, fallbackText) {
  try {
    return fs.readFileSync(path.join(promptsDir, fileName), 'utf8');
  } catch (_e) {
    return fallbackText;
  }
}

// --- Patient Explanation generator ---

// Converts the structured rule output into 3-4 warm sentences for the patient portal.
export async function generatePatientExplanation(engineOutput) {
  const client = await getGeminiClient();

  // Extract structured context from engine output
  const glucoseValue  = engineOutput.triggeredRule
    ? (engineOutput.computedFeatures?.tirPercent ?? 'N/A')
    : 'N/A';
  const ruleId        = engineOutput.triggeredRule?.id        ?? 'NO_RULE_TRIGGERED';
  const riskLevel     = engineOutput.riskLevel                ?? 'low';
  const recommendation = engineOutput.recommendation          ?? '';
  const tirPercent    = engineOutput.computedFeatures?.tirPercent   ?? 'N/A';
  const cvPercent     = engineOutput.computedFeatures?.cvPercent    ?? 'N/A';
  const glucoseTrend  = engineOutput.computedFeatures?.glucoseTrend ?? 'insufficient_data';

  if (!client) {
    return (
      `Based on your latest reading, the clinical engine identified: ${ruleId.replace(/_/g, ' ')}. ` +
      `Your risk level is ${riskLevel}. ${recommendation} ` +
      `(Detailed AI explanation is unavailable — ensure GEMINI_API_KEY is set in your .env file.)`
    );
  }

  const systemPrompt = loadPrompt(
    'systemPrompt.txt',
    'You are a safe diabetes health coach AI. Explain the recommendation output empathetically. Never diagnose or suggest medication changes.'
  );

  const patientPromptTemplate = loadPrompt(
    'patientPrompt.txt',
    `Risk Level: {riskLevel}\nRule Triggered: {ruleId}\nTime in Range: {tirPercent}%\nGlucose Variability: {cvPercent}%\nGlucose Trend: {glucoseTrend}\nClinical Action: {recommendation}`
  );

  const userPrompt = patientPromptTemplate
    .replace('{riskLevel}',     riskLevel)
    .replace('{ruleId}',        ruleId)
    .replace('{tirPercent}',    String(tirPercent))
    .replace('{cvPercent}',     String(cvPercent))
    .replace('{glucoseTrend}',  glucoseTrend)
    .replace('{recommendation}', recommendation);

  try {
    const response = await client.models.generateContent({
      model:    'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature:       0.3,  // Warm, conversational tone
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error('[GeminiService] Patient explanation API error:', error.message);
    return (
      `Your ${riskLevel}-risk reading has been logged. ${recommendation} ` +
      `(AI explanation temporarily unavailable.)`
    );
  }
}

// --- Doctor Summary generator ---

// Formats clinical context into a concise summary card for the attending doctor.
export async function generateDoctorSummary(engineOutput) {
  const client = await getGeminiClient();

  const ruleId         = engineOutput.triggeredRule?.id              ?? 'NO_RULE_TRIGGERED';
  const severity       = engineOutput.triggeredRule?.severity        ?? 'low';
  const riskLevel      = engineOutput.riskLevel                      ?? 'low';
  const riskScore      = engineOutput.riskScore                      ?? 0;
  const recommendation = engineOutput.recommendation                 ?? '';
  const confidence     = engineOutput.triggeredRule?.ruleConfidenceScore ?? 'N/A';
  const tirPercent     = engineOutput.computedFeatures?.tirPercent   ?? 'N/A';
  const cvPercent      = engineOutput.computedFeatures?.cvPercent    ?? 'N/A';
  const glucoseTrend   = engineOutput.computedFeatures?.glucoseTrend ?? 'insufficient_data';
  const adherenceRate  = engineOutput.computedFeatures?.adherenceRate ?? 'N/A';
  const secondaryRisks = (engineOutput.secondaryRisks ?? []).join(', ') || 'None';

  if (!client) {
    return (
      `Clinical Rule: ${ruleId} | Severity: ${severity} | Risk Score: ${riskScore}/100. ` +
      `TIR: ${tirPercent}% | %CV: ${cvPercent}% | Trend: ${glucoseTrend} | ` +
      `Adherence: ${adherenceRate}%. Secondary rules: ${secondaryRisks}. ` +
      `Recommended action: ${recommendation} ` +
      `(AI summary unavailable — ensure GEMINI_API_KEY is set.)`
    );
  }

  const systemPrompt = loadPrompt(
    'systemPrompt.txt',
    'You are a clinical AI assistant. Provide a brief, precise physician-level summary. Do not diagnose or prescribe.'
  );

  const doctorPromptTemplate = loadPrompt(
    'doctorPrompt.txt',
    `Risk Level: {riskLevel} (Score: {riskScore}/100)\nPrimary Rule: {ruleId} (Severity: {severity}, Confidence: {confidence})\nSecondary Rules: {secondaryRisks}\nTIR: {tirPercent}% | CV: {cvPercent}% | Trend: {glucoseTrend} | Adherence: {adherenceRate}%\nRecommended Action: {recommendation}`
  );

  const userPrompt = doctorPromptTemplate
    .replace('{riskLevel}',      riskLevel)
    .replace('{riskScore}',      String(riskScore))
    .replace('{ruleId}',         ruleId)
    .replace('{severity}',       severity)
    .replace('{confidence}',     String(confidence))
    .replace('{secondaryRisks}', secondaryRisks)
    .replace('{tirPercent}',     String(tirPercent))
    .replace('{cvPercent}',      String(cvPercent))
    .replace('{glucoseTrend}',   glucoseTrend)
    .replace('{adherenceRate}',  String(adherenceRate))
    .replace('{recommendation}', recommendation);

  try {
    const response = await client.models.generateContent({
      model:    'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature:       0.2,  // Precise, clinical tone for doctor summary
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error('[GeminiService] Doctor summary API error:', error.message);
    return (
      `Rule: ${ruleId} | Risk: ${riskLevel} (${riskScore}/100) | ` +
      `TIR: ${tirPercent}% | CV: ${cvPercent}% | Adherence: ${adherenceRate}%. ` +
      `Action: ${recommendation} (AI summary temporarily unavailable.)`
    );
  }
}
