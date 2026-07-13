import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateRecommendation } from './services/recommendationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load synthetic patient records to test the rules
const patientsPath = path.join(__dirname, 'datasets', 'sample_patients.json');
const patients = JSON.parse(fs.readFileSync(patientsPath, 'utf8'));

console.log('========================================================================');
console.log('      GLUCOCONNECT RECOMMENDATION ENGINE - MANUAL VALIDATION RUNNER ');
console.log('========================================================================\n');

for (const patient of patients) {
  console.log(`Patient Profile : ${patient.name} (${patient.id})`);
  console.log(`Current Reading : ${patient.currentReading.glucoseReading} mg/dL [${patient.currentReading.readingType}]`);
  console.log(`Activity Level  : ${patient.currentReading.activityLevel}`);
  console.log(`Meal Status     : ${patient.currentReading.mealStatus}`);
  if (patient.currentReading.recentMealDescription) {
    console.log(`Meal Description: "${patient.currentReading.recentMealDescription}"`);
  }
  if (patient.history && patient.history.length > 0) {
    console.log(`History Records : ${patient.history.length} log(s) loaded.`);
  }

  try {
    const recommendation = generateRecommendation({
      currentReading: patient.currentReading,
      history: patient.history
    });

    console.log('\n--- Output Payload ---');
    console.log(JSON.stringify(recommendation, null, 2));
  } catch (err) {
    console.error(`\n[ERROR] Evaluation failed for patient ${patient.id}: ${err.message}`);
  }
  console.log('\n' + '='.repeat(72) + '\n');
}
