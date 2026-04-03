/**
 * Step 3: Brand lens check on all draft-worthy emails
 * Question: "Would I confidently send this response to a high-value Sagitine customer?"
 */

import { classifyEmail } from './api/internal/services/classification-engine.js';

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║           👁️ BRAND LENS CHECK - Draft Quality Assessment              ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Test cases that should produce drafts (safe_to_auto_draft: true)
const draftTests = [
  {
    name: "Missing screw - shipping issue",
    subject: "Missing screw from order",
    body: "Hi, I received my order but one of the screws is missing from the hardware pack. Can you send a replacement?",
    from: "Customer",
    safeToDraft: true,
  },
  {
    name: "Gift timing urgency",
    subject: "Urgent — gift needs to arrive by Friday",
    body: "Hi, I need this order to arrive by Friday for a birthday gift. Can you guarantee delivery?",
    from: "Customer",
    safeToDraft: true,
  },
  {
    name: "Exchange request",
    subject: "Exchange for different size",
    body: "Hi, I ordered the small case but it's too small. Can I exchange for the medium?",
    from: "Customer",
    safeToDraft: true,
  },
  {
    name: "Pre-purchase storage question",
    subject: "Storage capacity question",
    body: "Hi, I'm looking at the large jewellery case — could you tell me approximately how many rings and necklaces it can hold?",
    from: "Customer",
    safeToDraft: true,
  },
  {
    name: "Return without receipt",
    subject: "Return — received as gift",
    body: "Hi, I received this as a gift but don't have the receipt. Can I still return it?",
    from: "Customer",
    safeToDraft: true,
  }
];

let passCount = 0;
let failCount = 0;

draftTests.forEach((test, i) => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`TEST ${i + 1}: ${test.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const result = classifyEmail(test.subject, test.body, test.from);

  console.log(`Category: ${result.category_primary}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`Safe to draft: ${result.safe_to_auto_draft}`);
  console.log(`Safe to send: ${result.safe_to_auto_send}`);

  // Brand lens assessment
  const wouldSendToHighValueCustomer = result.category_primary !== 'spam_solicitation' &&
                                         result.category_primary !== 'other_uncategorized' &&
                                         result.safe_to_auto_draft === true &&
                                         result.confidence >= 0.7;

  console.log(`\n👁️ BRAND LENS: "Would I send this to a high-value Sagitine customer?"`);
  console.log(`   ${wouldSendToHighValueCustomer ? '✅ YES - Confident to send' : '❌ NO - Requires human review'}`);

  if (wouldSendToHighValueCustomer) {
    passCount++;
  } else {
    failCount++;
  }
  console.log('');
});

// Summary
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║                    📊 BRAND LENS RESULTS                          ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Total tested: ${draftTests.length}`);
console.log(`✅ Pass: ${passCount}/${draftTests.length}`);
console.log(`❌ Fail: ${failCount}/${draftTests.length}`);
console.log('');
if (passCount === draftTests.length) {
  console.log('✅ PASS: All draft-worthy emails pass brand lens check');
} else {
  console.log('❌ FAIL: Some drafts require human review before sending');
}
