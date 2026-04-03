#!/usr/bin/env node
/**
 * Remove duplicate entries from training data
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_classification_training.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Track seen IDs
const seenIds = new Set();
const uniqueData = [];

// Keep first occurrence of each ID (the one with "courier" in ship_016's case)
data.forEach(entry => {
  if (!seenIds.has(entry.id)) {
    seenIds.add(entry.id);
    uniqueData.push(entry);
  } else {
    console.log(`✓ Removed duplicate entry: ${entry.id} - ${entry.title}`);
  }
});

console.log(`✓ Removed ${data.length - uniqueData.length} duplicate entries`);

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(uniqueData, null, 2), 'utf-8');
console.log('✓ File saved');

// Verification
const verify = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
console.log(`✓ Verification: ${verify.length} total scenarios in training data`);

// Count by category
const categoryCounts = {};
verify.forEach(entry => {
  if (entry.is_active !== false) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
  }
});

console.log('\n📊 Active scenarios by category:');
Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count}`);
});
