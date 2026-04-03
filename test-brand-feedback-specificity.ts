/**
 * Step 4: Confirm brand_feedback_general no longer fires on emails with questions or action requests
 */

import { classifyEmail } from './api/internal/services/classification-engine.js';

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║      🔍 BRAND_FEEDBACK_GENERAL SPECIFICITY VERIFICATION                 ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Test cases that should NOT route to brand_feedback_general
const nonBrandFeedbackTests = [
  {
    name: "Question mark present",
    subject: "Quick question about shipping",
    body: "Do you ship to New Zealand?",
    from: "Customer",
    shouldNotBe: "brand_feedback_general",
  },
  {
    name: "Action request - 'can you'",
    subject: "Can you help me?",
    body: "Can you change my delivery address?",
    from: "Customer",
    shouldNotBe: "brand_feedback_general",
  },
  {
    name: "Action request - 'please'",
    subject: "Address correction needed",
    body: "Please update my shipping address",
    from: "Customer",
    shouldNotBe: "brand_feedback_general",
  },
  {
    name: "Action request - 'would like'",
    subject: "Order modification",
    body: "I would like to add an item to my order",
    from: "Customer",
    shouldNotBe: "brand_feedback_general",
  },
  {
    name: "Order reference present",
    subject: "Order #12345",
    body: "Thank you for my recent order",
    from: "Customer",
    shouldNotBe: "brand_feedback_general",
  },
  {
    name: "International shipping enquiry",
    subject: "Shipping to Europe?",
    body: "What are your shipping rates for international orders?",
    from: "Customer",
    shouldNotBe: "brand_feedback_general",
  },
  {
    name: "Gift purchase with advice",
    subject: "Gift for my sister",
    body: "I'm looking for a gift - what would you recommend for someone who loves jewellery?",
    from: "Customer",
    shouldNotBe: "brand_feedback_general",
  }
];

let passCount = 0;
let failCount = 0;

nonBrandFeedbackTests.forEach((test, i) => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`TEST ${i + 1}: ${test.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const result = classifyEmail(test.subject, test.body, test.from);

  console.log(`Subject: "${test.subject}"`);
  console.log(`Body excerpt: "${test.body.substring(0, 50)}..."`);
  console.log(`\nClassified as: ${result.category_primary}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);

  const passed = result.category_primary !== test.shouldNotBe;
  console.log(`\n✅ PASS: Correctly NOT classified as ${test.shouldNotBe}`);

  if (passed) {
    passCount++;
  } else {
    failCount++;
    console.log(`❌ FAIL: Incorrectly classified as ${test.shouldNotBe}`);
  }
  console.log('');
});

// Summary
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║                    📊 SPECIFICITY CHECK RESULTS                   ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Total tested: ${nonBrandFeedbackTests.length}`);
console.log(`✅ Pass: ${passCount}/${nonBrandFeedbackTests.length}`);
console.log(`❌ Fail: ${failCount}/${nonBrandFeedbackTests.length}`);
console.log('');

if (failCount === 0) {
  console.log('✅ PASS: brand_feedback_general specificity check passed');
  console.log('   ✓ No emails with questions routed to brand_feedback_general');
  console.log('   ✓ No emails with action requests routed to brand_feedback_general');
  console.log('   ✓ No emails with order references routed to brand_feedback_general');
} else {
  console.log('❌ FAIL: brand_feedback_general is still over-matching');
  console.log('   Requires further refinement of specificity rules');
}
