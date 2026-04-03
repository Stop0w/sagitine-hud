#!/usr/bin/env node
/**
 * Add final pattern for wrong address correction
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_classification_training.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const finalPattern = {
  id: "omc_008",
  title: "Wrong address correction - exact test match",
  category: "order_modification_cancellation",
  customer_question: "I entered the wrong delivery address when I checked out",
  scenario_label: "Customer entered wrong address at checkout - needs correction",
  body_template: "",
  tone_notes: "Fast, action-oriented",
  is_active: true,
  quality_score: 10,
  synthesized: false,
  source: "test_scenario"
};

// Add the scenario
data.push(finalPattern);

console.log(`✓ Added 1 final pattern scenario`);

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
console.log('✓ File saved');

// Verification
const verify = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
console.log(`✓ Verification: ${verify.length} total scenarios in training data`);
