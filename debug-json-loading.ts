#!/usr/bin/env npx tsx
/**
 * Debug script to test JSON file loading
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('Current working directory:', process.cwd());
console.log('Testing file loading...\n');

// Test 1: Load gold_classification_training.json
console.log('━'.repeat(80));
console.log('TEST 1: gold_classification_training.json');
console.log('━'.repeat(80));

try {
  const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_classification_training.json');
  console.log('File path:', filePath);
  console.log('File exists:', fs.existsSync(filePath));

  const stats = fs.statSync(filePath);
  console.log('File size:', stats.size, 'bytes');

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  console.log('File content length:', fileContent.length);

  // Try to parse
  const data = JSON.parse(fileContent);
  console.log('✓ JSON parsed successfully');
  console.log('Data type:', Array.isArray(data) ? 'array' : typeof data);
  console.log('Array length:', Array.isArray(data) ? data.length : 'N/A');
  console.log('First entry:', data[0] ? data[0].id : 'N/A');
} catch (error: any) {
  console.log('❌ Error:', error.message);
  console.log('Error position:', error.message.match(/position (\d+)/)?.[1]);
}

console.log('');

// Test 2: Load gold_response_templates.json
console.log('━'.repeat(80));
console.log('TEST 2: gold_response_templates.json');
console.log('━'.repeat(80));

try {
  const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_response_templates.json');
  console.log('File path:', filePath);
  console.log('File exists:', fs.existsSync(filePath));

  const stats = fs.statSync(filePath);
  console.log('File size:', stats.size, 'bytes');

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  console.log('File content length:', fileContent.length);

  // Try to parse
  const data = JSON.parse(fileContent);
  console.log('✓ JSON parsed successfully');
  console.log('Data type:', Array.isArray(data) ? 'array' : typeof data);

  const templates = Array.isArray(data) ? data : (data.templates || []);
  console.log('Template count:', templates.length);
  console.log('First template:', templates[0] ? templates[0].id : 'N/A');
} catch (error: any) {
  console.log('❌ Error:', error.message);
}

console.log('');

// Test 3: Load gold_master_index.json
console.log('━'.repeat(80));
console.log('TEST 3: gold_master_index.json');
console.log('━'.repeat(80));

try {
  const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_master_index.json');
  console.log('File path:', filePath);
  console.log('File exists:', fs.existsSync(filePath));

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(fileContent);
  console.log('✓ JSON parsed successfully');
  console.log('Categories:', Object.keys(data.categories).length);
  console.log('First category:', Object.keys(data.categories)[0]);
} catch (error: any) {
  console.log('❌ Error:', error.message);
}

console.log('');
console.log('━'.repeat(80));
console.log('All file loading tests complete');
console.log('━'.repeat(80));
