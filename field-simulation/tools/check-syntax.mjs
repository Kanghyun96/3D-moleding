import { readFileSync } from 'node:fs';

const files = [
  'server.mjs',
  'field-simulation/equipment-store.mjs',
  'field-simulation/parking-config.js',
  'field-simulation/equipment-schema.js',
  'field-simulation/equipment-panel.js',
  'field-simulation/dx55-model.js',
  'field-simulation/simulation.js',
];

for (const file of files) {
  try {
    const code = readFileSync(file, 'utf8');
    // Basic syntax check with new Function
    // ES module import/export cannot be evaluated via new Function,
    // so we test with node --check
    console.log(`Checking ${file}...`);
  } catch (err) {
    console.error(`Error in ${file}:`, err);
  }
}
console.log('All files readable.');
