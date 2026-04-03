// Test script for new classification system
// Run with: node test-classification.js

import { classifyEmail } from './api/internal/services/classification-engine.ts';
import { generateDraft } from './api/internal/services/template-lookup.ts';

console.log('=========================================');
console.log('TEST 1: Product usage - drawers hard to open');
console.log('=========================================');

const test1 = classifyEmail(
  'The drawers are really hard to open, is this normal?',
  'The drawers are really hard to open, is this normal? I am worried there might be something wrong with my stand.',
  'Sarah'
);

console.log('Category:', test1.category_primary);
console.log('Confidence:', test1.confidence);
console.log('Safe to auto draft:', test1.safe_to_auto_draft);
console.log('Matched scenario:', test1.matched_scenario_label);
console.log('Match score:', test1.match_score);

const draft1 = generateDraft(test1.category_primary, 'Sarah');
console.log('Draft generated:', !!draft1);
if (draft1) {
  console.log('Draft preview:', draft1.substring(0, 200) + '...');
}

console.log('');
console.log('=========================================');
console.log('TEST 2: Spam - collaboration opportunity');
console.log('=========================================');

const test2 = classifyEmail(
  'Quick collaboration opportunity',
  'Let us jump on a call to discuss a guaranteed 10x revenue opportunity for your business.',
  'Marketing Agency'
);

console.log('Category:', test2.category_primary);
console.log('Confidence:', test2.confidence);
console.log('Safe to auto draft:', test2.safe_to_auto_draft);
console.log('Matched scenario:', test2.matched_scenario_label);

const draft2 = generateDraft(test2.category_primary, 'Marketing Agency');
console.log('Draft generated:', !!draft2);

console.log('');
console.log('=========================================');
console.log('TEST 3: Damaged - boxes arrived with marks');
console.log('=========================================');

const test3 = classifyEmail(
  'My boxes arrived with marks and dents',
  'I just received my order and several of the boxes have marks and dents on them, particularly the ones in the corner of the packaging.',
  'Emma'
);

console.log('Category:', test3.category_primary);
console.log('Confidence:', test3.confidence);
console.log('Safe to auto draft:', test3.safe_to_auto_draft);
console.log('Matched scenario:', test3.matched_scenario_label);
console.log('Match score:', test3.match_score);

const draft3 = generateDraft(test3.category_primary, 'Emma');
console.log('Draft generated:', !!draft3);
if (draft3) {
  console.log('Draft preview:', draft3.substring(0, 200) + '...');
}

console.log('');
console.log('=========================================');
console.log('All tests complete');
console.log('=========================================');
