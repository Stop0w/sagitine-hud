#!/usr/bin/env npx tsx
/**
 * FINAL TEST SET — 10 EMAIL SIMULATION
 * Testing new gold response classification system
 *
 * Previous result: 20% accuracy (2/10 correct)
 * Target: ≥90% accuracy (9/10+ correct)
 */

import * as fs from 'fs';
import * as path from 'path';
import { classifyEmail } from './api/internal/services/classification-engine';
import { generateDraft } from './api/internal/services/template-lookup';

// Mock process.cwd() for file reading
process.cwd = () => 'C:\\Users\\hayde\\Sagitine Customer Service Agent\\sagitine-hud';

// Load test cases from JSON
const testCasesPath = path.join(process.cwd(), 'test-cases.json');
const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║           🧪 FINAL TEST SET — 10 EMAIL SIMULATION                   ║');
console.log('║            Testing New Gold Response Classification System          ║');
console.log('║                                                                    ║');
console.log('║  Previous Result: 20% accuracy (2/10 correct)                      ║');
console.log('║  Target: ≥90% accuracy (9/10+ correct)                             ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');

let correctClassifications = 0;
let totalTests = testCases.length;
const results: any[] = [];

for (const testCase of testCases) {
  console.log('━'.repeat(80));
  console.log(`📧 ${testCase.name}`);
  console.log('━'.repeat(80));
  console.log(`Subject: ${testCase.subject}`);
  console.log(`Expected: ${testCase.expectedCategory} | Safe to draft: ${testCase.expectedSafeToDraft}`);
  console.log('');

  // Run classification
  const classification = classifyEmail(testCase.subject, testCase.body, testCase.fromName);

  // Generate draft if safe_to_auto_draft
  const draft = classification.safe_to_auto_draft
    ? generateDraft(classification.category_primary, testCase.fromName)
    : null;

  // Check results
  const categoryMatch = classification.category_primary === testCase.expectedCategory;
  const safeToDraftMatch = classification.safe_to_auto_draft === testCase.expectedSafeToDraft;

  if (categoryMatch) {
    correctClassifications++;
  }

  results.push({
    test: testCase,
    actualCategory: classification.category_primary,
    actualSafeToDraft: classification.safe_to_auto_draft,
    categoryMatch,
    safeToDraftMatch,
    draftGenerated: draft !== null,
    confidence: classification.confidence,
    matchedScenario: classification.matched_scenario_label,
    matchScore: classification.match_score,
  });

  // Display results
  console.log(`✅ ACTUAL RESULTS:`);
  console.log(`   Category: ${classification.category_primary} ${categoryMatch ? '✅' : '❌'}`);
  console.log(`   Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
  console.log(`   Safe to draft: ${classification.safe_to_auto_draft} ${safeToDraftMatch ? '✅' : '❌'}`);
  console.log(`   Matched scenario: ${classification.matched_scenario_label || 'None'}`);
  console.log(`   Match score: ${classification.match_score.toFixed(2)}`);

  if (draft) {
    console.log('');
    console.log(`📝 DRAFT PREVIEW:`);
    console.log('─'.repeat(80));
    const lines = draft.split('\n');
    const preview = lines.slice(0, 8).join('\n');
    console.log(preview);
    if (lines.length > 8) {
      console.log('...');
    }
    console.log('─'.repeat(80));

    // Quality checks
    const draftLower = draft.toLowerCase();
    const hasBotLanguage = draftLower.includes('apologise for the inconvenience');
    const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]/u.test(draft);
    const hasRoboticPhrasing = draftLower.includes('please do not hesitate') || draftLower.includes('we apologise');

    console.log('');
    console.log(`🔍 DRAFT QUALITY CHECKS:`);
    console.log(`   No bot language: ${!hasBotLanguage ? '✅' : '❌'}`);
    console.log(`   No emojis: ${!hasEmojis ? '✅' : '❌'}`);
    console.log(`   No robotic phrasing: ${!hasRoboticPhrasing ? '✅' : '❌'}`);
  } else {
    console.log('');
    console.log(`📝 DRAFT: None (safe_to_auto_draft: false)`);
  }

  console.log('');
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║                        📊 RESULTS SUMMARY                         ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');

const accuracy = (correctClassifications / totalTests) * 100;

console.log(`🎯 CLASSIFICATION ACCURACY: ${correctClassifications}/${totalTests} (${accuracy.toFixed(0)}%)`);
console.log(`   Target: ≥90% (9/10+)`);
console.log(`   Previous: 20% (2/10)`);
console.log('');

if (accuracy >= 90) {
  console.log('✅ PASS: System meets go-live threshold');
} else if (accuracy >= 70) {
  console.log('⚠️  PARTIAL: System improved but needs refinement');
} else {
  console.log('❌ FAIL: System not ready for production');
}

console.log('');
console.log('━'.repeat(80));
console.log('DETAILED RESULTS:');
console.log('━'.repeat(80));
console.log('');

results.forEach((result, i) => {
  const status = result.categoryMatch ? '✅' : '❌';
  const confidence = `${(result.confidence * 100).toFixed(0)}%`;

  console.log(`${status} Test ${i + 1}: ${result.test.name}`);
  console.log(`   Expected: ${result.test.expectedCategory} | Actual: ${result.actualCategory}`);
  console.log(`   Confidence: ${confidence} | Match: ${result.matchedScenario || 'None'}`);

  if (!result.categoryMatch) {
    console.log(`   ⚠️  MISMATCH: Expected ${result.test.expectedCategory}, got ${result.actualCategory}`);
  }

  console.log('');
});

// ============================================================================
// CATEGORY BREAKDOWN
// ============================================================================

console.log('━'.repeat(80));
console.log('CATEGORY BREAKDOWN:');
console.log('━'.repeat(80));
console.log('');

const categoryBreakdown = new Map<string, { correct: number; total: number }>();

results.forEach((result) => {
  const cat = result.test.expectedCategory;
  if (!categoryBreakdown.has(cat)) {
    categoryBreakdown.set(cat, { correct: 0, total: 0 });
  }
  const stats = categoryBreakdown.get(cat)!;
  stats.total++;
  if (result.categoryMatch) {
    stats.correct++;
  }
});

categoryBreakdown.forEach((stats, category) => {
  const catAccuracy = (stats.correct / stats.total) * 100;
  console.log(`${category}:`);
  console.log(`  ${stats.correct}/${stats.total} correct (${catAccuracy.toFixed(0)}%)`);
  console.log('');
});

// ============================================================================
// DRAFT QUALITY ANALYSIS
// ============================================================================

console.log('━'.repeat(80));
console.log('DRAFT QUALITY ANALYSIS:');
console.log('━'.repeat(80));
console.log('');

const draftsWithIssues: string[] = [];

results.forEach((result) => {
  if (result.draftGenerated) {
    const draft = generateDraft(result.actualCategory, result.test.fromName);
    if (!draft) return;

    const draftLower = draft.toLowerCase();
    const hasBotLanguage = draftLower.includes('apologise for the inconvenience');
    const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]/u.test(draft);
    const hasRoboticPhrasing = draftLower.includes('please do not hesitate') || draftLower.includes('we apologise');

    if (hasBotLanguage || hasEmojis || hasRoboticPhrasing) {
      const issues = [];
      if (hasBotLanguage) issues.push('BOT LANGUAGE');
      if (hasEmojis) issues.push('EMOJIS');
      if (hasRoboticPhrasing) issues.push('ROBOTIC');
      draftsWithIssues.push(`${result.test.name}: ${issues.join(' + ')}`);
    }
  }
});

if (draftsWithIssues.length === 0) {
  console.log('✅ All drafts passed quality checks');
  console.log('   No bot language, emojis, or robotic phrasing detected');
} else {
  console.log('❌ Some drafts have quality issues:');
  draftsWithIssues.forEach((issue) => {
    console.log(`   - ${issue}`);
  });
}

console.log('');
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  "Would I confidently send this to a high-value Sagitine customer?" ║');
console.log('║                                                                    ║');
console.log(`║  ${accuracy >= 90 ? '✅ YES — System ready for go-live' : '❌ NO — System needs refinement'}`);
console.log('╚════════════════════════════════════════════════════════════════════╝');
