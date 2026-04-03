#!/usr/bin/env npx tsx
/**
 * EXTENDED TEST SUITE — 30 ADDITIONAL CASES
 * 3 tests per category × 10 categories
 *
 * Previous result: 9/10 correct (90%)
 * Target: ≥90% on extended suite
 */

import * as fs from 'fs';
import * as path from 'path';
import { classifyEmail } from './api/internal/services/classification-engine';
import { generateDraft } from './api/internal/services/template-lookup';

// Mock process.cwd() for file reading
process.cwd = () => 'C:\\Users\\hayde\\Sagitine Customer Service Agent\\sagitine-hud';

interface ExtendedTestCase {
  suite_id: string;
  category: string;
  test_id: string;
  subject: string;
  body: string;
  fromName: string;
  expectedCategory: string;
  expectedSafeToDraft: boolean;
  expectedTone: string;
  notes: string;
  criticalEdgeCase: boolean;
}

const testCases: ExtendedTestCase[] = [
  // CATEGORY 1 — shipping_delivery_order_issue
  {
    suite_id: "1.2",
    category: "shipping_delivery_order_issue",
    test_id: "Tracking failure variant",
    subject: "Where is my parcel?",
    body: `Hi, I placed an order 12 days ago and still haven't received it. The tracking number you sent me isn't showing any updates. Is something wrong?\nThanks, James`,
    fromName: "James",
    expectedCategory: "shipping_delivery_order_issue",
    expectedSafeToDraft: true,
    expectedTone: "Reassuring + proactive",
    notes: "Tracking failure — higher anxiety signal",
    criticalEdgeCase: false,
  },
  {
    suite_id: "1.3",
    category: "shipping_delivery_order_issue",
    test_id: "Delivered to wrong address",
    subject: "Delivered to wrong address",
    body: `Hello, my order says it was delivered yesterday but I haven't received anything. I'm wondering if it's been left with a neighbour or sent to the wrong place. Can you help?\nMany thanks, Priya`,
    fromName: "Priya",
    expectedCategory: "shipping_delivery_order_issue",
    expectedSafeToDraft: true,
    expectedTone: "Calm + investigative",
    notes: "Delivered but not received — highest friction shipping scenario",
    criticalEdgeCase: false,
  },
  {
    suite_id: "1.4",
    category: "shipping_delivery_order_issue",
    test_id: "Gift timing urgency",
    subject: "Urgent — gift needs to arrive by Friday",
    body: `Hi there, I ordered a gift for my mother's birthday last week and I'm worried it won't arrive in time. Her birthday is this Friday. Is there anything you can do to expedite it?\nThank you, Natalie`,
    fromName: "Natalie",
    expectedCategory: "shipping_delivery_order_issue",
    expectedSafeToDraft: true,
    expectedTone: "Warm + urgent, emotionally aware",
    notes: "Time-sensitive + emotional stakes",
    criticalEdgeCase: false,
  },

  // CATEGORY 2 — damaged_missing_faulty
  {
    suite_id: "2.2",
    category: "damaged_missing_faulty",
    test_id: "Item missing from order",
    subject: "Item missing from my order",
    body: `Hi, my order arrived today but I only received one item when I ordered two. The packing slip shows both, but only one was in the box. Please advise.\nBest, Thomas`,
    fromName: "Thomas",
    expectedCategory: "damaged_missing_faulty",
    expectedSafeToDraft: true,
    expectedTone: "Efficient + apologetic without over-apologising",
    notes: "Missing item variant",
    criticalEdgeCase: false,
  },
  {
    suite_id: "2.3",
    category: "damaged_missing_faulty",
    test_id: "Product not as described",
    subject: "Product not as described",
    body: `Hello, the organiser I received looks different to what was shown on the website. The colour is much darker and the interior lining appears to be a different material. I'm quite disappointed.\nKind regards, Emma`,
    fromName: "Emma",
    expectedCategory: "damaged_missing_faulty",
    expectedSafeToDraft: true,
    expectedTone: "Empathetic + brand-protective, no defensiveness",
    notes: "Expectation mismatch — emotionally loaded, brand risk",
    criticalEdgeCase: true,
  },
  {
    suite_id: "2.4",
    category: "damaged_missing_faulty",
    test_id: "Broken clasp on arrival",
    subject: "Broken clasp on arrival",
    body: `Hi, I received my order this morning and unfortunately the clasp on the case is already broken — it won't stay shut. I haven't even used it yet. Very disappointing for something at this price point.\nRegards, Jonathan`,
    fromName: "Jonathan",
    expectedCategory: "damaged_missing_faulty",
    expectedSafeToDraft: true,
    expectedTone: "Empathetic + premium, acknowledges price sensitivity",
    notes: "Price point reference — high-value customer",
    criticalEdgeCase: false,
  },

  // CATEGORY 3 — pre_purchase_question
  {
    suite_id: "3.2",
    category: "pre_purchase_question",
    test_id: "Storage capacity question",
    subject: "Storage capacity question",
    body: `Hi, I'm looking at the large jewellery case — could you tell me approximately how many rings and necklaces it can hold? I have quite an extensive collection.\nThank you, Margaret`,
    fromName: "Margaret",
    expectedCategory: "pre_purchase_question",
    expectedSafeToDraft: true,
    expectedTone: "Consultative + helpful, treats as high-value prospect",
    notes: "Specific product detail query",
    criticalEdgeCase: false,
  },
  {
    suite_id: "3.3",
    category: "pre_purchase_question",
    test_id: "International shipping enquiry",
    subject: "Do you ship internationally?",
    body: `Hello, I'm based in Singapore and found your store online. I'd love to order — do you ship internationally and what would the cost be?\nThanks, Lin`,
    fromName: "Lin",
    expectedCategory: "pre_purchase_question",
    expectedSafeToDraft: true,
    expectedTone: "Warm + welcoming, no friction",
    notes: "International prospect — high conversion value",
    criticalEdgeCase: false,
  },
  {
    suite_id: "3.4",
    category: "pre_purchase_question",
    test_id: "Gift purchase with advice needed",
    subject: "Looking for a gift",
    body: `Hi, I'm trying to find a gift for my wife who loves jewellery. She has a lot of pieces — rings, necklaces, earrings. What would you recommend for someone with a larger collection?\nThank you, Robert`,
    fromName: "Robert",
    expectedCategory: "pre_purchase_question",
    expectedSafeToDraft: true,
    expectedTone: "Warm + consultative, gift-aware",
    notes: "Gift purchase — emotional intent, high conversion moment",
    criticalEdgeCase: false,
  },

  // CATEGORY 4 — return_refund_exchange
  {
    suite_id: "4.2",
    category: "return_refund_exchange",
    test_id: "Exchange for different size",
    subject: "Exchange for different size",
    body: `Hi, I love the case I received but I think I need the larger version — I have more pieces than I anticipated. Is it possible to exchange it?\nThanks, Alice`,
    fromName: "Alice",
    expectedCategory: "return_refund_exchange",
    expectedSafeToDraft: true,
    expectedTone: "Positive + smooth, treats as opportunity not problem",
    notes: "Exchange not return — positive sentiment variant",
    criticalEdgeCase: false,
  },
  {
    suite_id: "4.3",
    category: "return_refund_exchange",
    test_id: "Return without receipt",
    subject: "Return — received as gift",
    body: `Hello, I received one of your cases as a gift but unfortunately already have something similar. I don't have the original receipt — is that okay for a return?\nMany thanks, Helen`,
    fromName: "Helen",
    expectedCategory: "return_refund_exchange",
    expectedSafeToDraft: true,
    expectedTone: "Gracious + low-friction",
    notes: "Gift return without receipt — adds complexity",
    criticalEdgeCase: true,
  },
  {
    suite_id: "4.4",
    category: "return_refund_exchange",
    test_id: "Refund status follow-up",
    subject: "Refund status",
    body: `Hi, I returned an item two weeks ago and was told to expect a refund within 7 days. I still haven't seen it come through on my statement. Can you check?\nBest, Mark`,
    fromName: "Mark",
    expectedCategory: "return_refund_exchange",
    expectedSafeToDraft: true,
    expectedTone: "Calm + confidence-building, proactive",
    notes: "Follow-up on existing return — growing frustration signal",
    criticalEdgeCase: false,
  },

  // CATEGORY 5 — order_modification_cancellation
  {
    suite_id: "5.2",
    category: "order_modification_cancellation",
    test_id: "Wrong address correction",
    subject: "Wrong address on my order",
    body: `Hi, I just realised I entered the wrong delivery address when I checked out. The order was placed about an hour ago — is it possible to update it before it ships?\nThanks, Sarah`,
    fromName: "Sarah",
    expectedCategory: "order_modification_cancellation",
    expectedSafeToDraft: true,
    expectedTone: "Fast + action-oriented",
    notes: "Address correction variant — time critical",
    criticalEdgeCase: false,
  },
  {
    suite_id: "5.3",
    category: "order_modification_cancellation",
    test_id: "Add item to order",
    subject: "Can I add to my order?",
    body: `Hello, I placed an order this morning and wanted to see if I could add another item to save on shipping. Is that possible at this stage?\nThank you, Ben`,
    fromName: "Ben",
    expectedCategory: "order_modification_cancellation",
    expectedSafeToDraft: true,
    expectedTone: "Helpful + commercial awareness",
    notes: "Addition not cancellation — positive intent",
    criticalEdgeCase: false,
  },
  {
    suite_id: "5.4",
    category: "order_modification_cancellation",
    test_id: "Wrong item selected",
    subject: "Change order — wrong item selected",
    body: `Hi, I ordered the small case but meant to order the medium. I only noticed when I got the confirmation email. Can this be changed?\nCheers, Liam`,
    fromName: "Liam",
    expectedCategory: "order_modification_cancellation",
    expectedSafeToDraft: true,
    expectedTone: "Efficient + reassuring",
    notes: "Item swap — common error scenario",
    criticalEdgeCase: false,
  },

  // CATEGORY 6 — account_billing_payment
  {
    suite_id: "6.2",
    category: "account_billing_payment",
    test_id: "Payment declined but money taken",
    subject: "Payment declined but money taken",
    body: `Hi, my payment was declined at checkout but I can see the amount has been debited from my account. I don't appear to have a confirmed order. Can you look into this please?\nRegards, Karen`,
    fromName: "Karen",
    expectedCategory: "account_billing_payment",
    expectedSafeToDraft: false,
    expectedTone: "Calm + urgent resolution, trust-building",
    notes: "Highest trust-risk billing scenario — money taken, no order confirmed",
    criticalEdgeCase: true,
  },
  {
    suite_id: "6.3",
    category: "account_billing_payment",
    test_id: "Account access issue",
    subject: "Can't log in to my account",
    body: `Hello, I'm trying to check on my order but can't seem to log into my account. I've tried resetting my password but haven't received the email.\nThanks, Daniel`,
    fromName: "Daniel",
    expectedCategory: "account_billing_payment",
    expectedSafeToDraft: true,
    expectedTone: "Helpful + calm",
    notes: "Account access issue — adjacent to billing",
    criticalEdgeCase: false,
  },
  {
    suite_id: "6.4",
    category: "account_billing_payment",
    test_id: "Discount code didn't apply",
    subject: "Discount code didn't apply",
    body: `Hi, I used a discount code at checkout but looking at my order confirmation the full price was charged. The code said it was valid. Can you help?\nThank you, Olivia`,
    fromName: "Olivia",
    expectedCategory: "account_billing_payment",
    expectedSafeToDraft: true,
    expectedTone: "Reassuring + proactive resolution",
    notes: "Small financial discrepancy but signals trust sensitivity",
    criticalEdgeCase: false,
  },

  // CATEGORY 7 — partnership_wholesale_press
  {
    suite_id: "7.2",
    category: "partnership_wholesale_press",
    test_id: "Gift hamper collaboration",
    subject: "Gift hamper collaboration",
    body: `Hi, I run a luxury gift hamper business and would love to include your pieces in our curated boxes. Would you be open to a conversation about supply or collaboration?\nWarm regards, Stephanie`,
    fromName: "Stephanie",
    expectedCategory: "partnership_wholesale_press",
    expectedSafeToDraft: true,
    expectedTone: "Professional",
    notes: "Collaboration variant — not pure wholesale",
    criticalEdgeCase: false,
  },
  {
    suite_id: "7.3",
    category: "partnership_wholesale_press",
    test_id: "Press enquiry",
    subject: "Press enquiry",
    body: `Hello, I'm a lifestyle editor at a home and interiors magazine. We're putting together a gift guide for our next issue and would love to feature your products. Could you send across a press kit or product images?\nBest, Charlotte`,
    fromName: "Charlotte",
    expectedCategory: "partnership_wholesale_press",
    expectedSafeToDraft: true,
    expectedTone: "Professional",
    notes: "Press not wholesale — high brand value",
    criticalEdgeCase: false,
  },
  {
    suite_id: "7.4",
    category: "partnership_wholesale_press",
    test_id: "Corporate gifting enquiry",
    subject: "Corporate gifting enquiry",
    body: `Hi, I work in procurement for a law firm and we're looking for premium gifts for around 40 clients this year. Are you able to accommodate bulk orders with custom packaging?\nThanks, Andrew`,
    fromName: "Andrew",
    expectedCategory: "partnership_wholesale_press",
    expectedSafeToDraft: true,
    expectedTone: "Professional",
    notes: "Corporate gifting — high value, non-standard",
    criticalEdgeCase: false,
  },

  // CATEGORY 8 — praise_testimonial_ugc
  {
    suite_id: "8.2",
    category: "praise_testimonial_ugc",
    test_id: "Third-party gifting praise",
    subject: "Gifted to my sister — she loves it",
    body: `Hi, just wanted to let you know I gave the jewellery case to my sister for her birthday and she was absolutely thrilled. The quality is exceptional. Thank you.\nBest, Patricia`,
    fromName: "Patricia",
    expectedCategory: "praise_testimonial_ugc",
    expectedSafeToDraft: true,
    expectedTone: "Warm",
    notes: "Third-party gifting praise — UGC and word-of-mouth signal",
    criticalEdgeCase: false,
  },
  {
    suite_id: "8.3",
    category: "praise_testimonial_ugc",
    test_id: "Instagram unboxing with followers",
    subject: "Featured you on my Instagram",
    body: `Hello! I posted an unboxing of my order on Instagram today and the response was incredible — people kept asking where I got it. Thought you'd want to know. My handle is @home.with.grace if you'd like to share it.\nGrace`,
    fromName: "Grace",
    expectedCategory: "praise_testimonial_ugc",
    expectedSafeToDraft: true,
    expectedTone: "Warm",
    notes: "Organic UGC with influencer signal — high value",
    criticalEdgeCase: false,
  },
  {
    suite_id: "8.4",
    category: "praise_testimonial_ugc",
    test_id: "5-star review notification",
    subject: "Left you a review",
    body: `Hi, I just left a 5-star review on your website. Wanted to let you know — the product is beautiful and arrived perfectly packaged. Really impressed.\nKind regards, Fiona`,
    fromName: "Fiona",
    expectedCategory: "praise_testimonial_ugc",
    expectedSafeToDraft: true,
    expectedTone: "Warm",
    notes: "Review notification — completed UGC action",
    criticalEdgeCase: false,
  },

  // CATEGORY 9 — spam_solicitation
  {
    suite_id: "9.2",
    category: "spam_solicitation",
    test_id: "Vendor services solicitation",
    subject: "We build websites for ecommerce brands",
    body: `Hi, I noticed your site could benefit from some conversion rate improvements. Our team specialises in Shopify redesigns. Would love to show you what we've done for similar brands.\nBest, Mike`,
    fromName: "Mike",
    expectedCategory: "spam_solicitation",
    expectedSafeToDraft: false,
    expectedTone: "N/A (should be ignored)",
    notes: "Vendor solicitation disguised as feedback",
    criticalEdgeCase: false,
  },
  {
    suite_id: "9.3",
    category: "spam_solicitation",
    test_id: "Influencer collaboration boundary test",
    subject: "Influencer collaboration opportunity",
    body: `Hi, I'm a content creator with 50K followers and I'd love to feature your products in exchange for gifting. Let me know if you're interested!\nThanks, Kylie`,
    fromName: "Kylie",
    expectedCategory: "spam_solicitation",
    expectedSafeToDraft: false,
    expectedTone: "N/A (should be ignored)",
    notes: "BOUNDARY TEST: Gifting requests from influencers with no prior relationship. Should route to manual if confidence < 85%",
    criticalEdgeCase: true,
  },
  {
    suite_id: "9.4",
    category: "spam_solicitation",
    test_id: "SEO audit fear hook",
    subject: "SEO audit — your site is losing traffic",
    body: `Hello, I ran a quick audit of your website and found several issues affecting your Google rankings. I can send you the full report for free. Interested?\nRegards, Kevin`,
    fromName: "Kevin",
    expectedCategory: "spam_solicitation",
    expectedSafeToDraft: false,
    expectedTone: "N/A (should be ignored)",
    notes: "Classic fear-based solicitation hook",
    criticalEdgeCase: false,
  },

  // CATEGORY 10 — other_uncategorized
  {
    suite_id: "10.2",
    category: "other_uncategorized",
    test_id: "Follow-up with no context",
    subject: "no subject",
    body: `Hi, just following up on my previous message. Have you had a chance to look into it?\nThanks`,
    fromName: "Customer",
    expectedCategory: "other_uncategorized",
    expectedSafeToDraft: false,
    expectedTone: "Neutral",
    notes: "Follow-up with no original context — impossible to categorise without thread history",
    criticalEdgeCase: false,
  },
  {
    suite_id: "10.3",
    category: "other_uncategorized",
    test_id: "Deliberately vague enquiry",
    subject: "General enquiry",
    body: `Hello, I have a question about one of your products. Could someone please get back to me when they have a moment?\nThank you, Susan`,
    fromName: "Susan",
    expectedCategory: "other_uncategorized",
    expectedSafeToDraft: false,
    expectedTone: "Neutral",
    notes: "Deliberately vague — no product named, no question asked",
    criticalEdgeCase: false,
  },
  {
    suite_id: "10.4",
    category: "other_uncategorized",
    test_id: "Reply fragment with no context",
    subject: "Re: Your order",
    body: `Thanks for getting back to me. That works for me.\nBest, Paul`,
    fromName: "Paul",
    expectedCategory: "other_uncategorized",
    expectedSafeToDraft: false,
    expectedTone: "Neutral",
    notes: "Reply fragment with no context — tests body-only classification vs thread context",
    criticalEdgeCase: true,
  },
];

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║          🧪 EXTENDED TEST SUITE — 30 ADDITIONAL CASES                   ║');
console.log('║            Testing New Gold Response Classification System                          ║');
console.log('║                                                                    ║');
console.log('║  Previous result: 9/10 correct (90%)                                   ║');
console.log('║  Target: ≥90% accuracy                                              ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');

let correctClassifications = 0;
let totalTests = testCases.length;
const results: any[] = [];
const categoryStats = new Map<string, { correct: number; total: number; confidenceScores: number[] }>();

for (const testCase of testCases) {
  console.log('━'.repeat(80));
  console.log(`📧 ${testCase.category} — ${testCase.test_id}`);
  console.log('━'.repeat(80));
  console.log(`Subject: ${testCase.subject.substring(0, 50)}...`);
  console.log(`Expected: ${testCase.expectedCategory} | Safe to draft: ${testCase.expectedSafeToDraft}`);
  if (testCase.criticalEdgeCase) {
    console.log(`⚠️  CRITICAL EDGE CASE: ${testCase.notes}`);
  }
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

  // Track category stats
  if (!categoryStats.has(testCase.category)) {
    categoryStats.set(testCase.category, { correct: 0, total: 0, confidenceScores: [] });
  }
  const stats = categoryStats.get(testCase.category)!;
  stats.total++;
  if (categoryMatch) {
    stats.correct++;
  }
  stats.confidenceScores.push(classification.confidence);

  results.push({
    testCase,
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
  const status = categoryMatch ? '✅' : '❌';
  const confidence = `${(classification.confidence * 100).toFixed(0)}%`;

  console.log(`${status} ACTUAL RESULTS:`);
  console.log(`   Category: ${classification.category_primary} ${categoryMatch ? '✅' : '❌'}`);
  console.log(`   Confidence: ${confidence}`);
  console.log(`   Safe to draft: ${classification.safe_to_auto_draft} ${safeToDraftMatch ? '✅' : '❌'}`);
  console.log(`   Matched scenario: ${classification.matched_scenario_label || 'None'}`);
  console.log(`   Match score: ${classification.match_score.toFixed(2)}`);

  if (testCase.criticalEdgeCase) {
    console.log(`   ⚠️  CRITICAL EDGE CASE NOTES: ${testCase.notes}`);
  }

  if (draft) {
    console.log('');
    console.log(`📝 DRAFT PREVIEW (first 150 chars):`);
    console.log(`   ${draft.substring(0, 150).replace(/\n/g, ' ')}...`);

    // Brand lens check for tone calibration tests
    if (['2.3', '4.3', '6.2'].includes(testCase.suite_id)) {
      const hasDefensiveness = draft.toLowerCase().includes('not as described') ||
                               draft.toLowerCase().includes('disappointed') ||
                               draft.toLowerCase().includes('wrong');
      const hasOverApology = (draft.toLowerCase().match(/sorry/g) || []).length > 1;

      console.log('');
      console.log(`🔍 BRAND LENS CHECK (Tone Calibration):`);
      console.log(`   Has defensiveness: ${hasDefensiveness ? '❌' : '✅'}`);
      console.log(`   Over-apologising: ${hasOverApology ? '❌' : '✅'}`);

      const lensPass = !hasDefensiveness && !hasOverApology;
      console.log(`   Brand lens: ${lensPass ? '✅ PASS' : '❌ FAIL'}`);
    }
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
console.log('║                        📊 EXTENDED TEST RESULTS                       ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');

const accuracy = (correctClassifications / totalTests) * 100;

console.log(`🎯 EXTENDED SUITE ACCURACY: ${correctClassifications}/${totalTests} (${accuracy.toFixed(0)}%)`);
console.log(`   Target: ≥90%`);
console.log(`   Previous baseline: 9/10 (90%)`);
console.log('');

if (accuracy >= 90) {
  console.log('✅ PASS: Extended suite meets threshold');
} else if (accuracy >= 80) {
  console.log('⚠️  PARTIAL: Close but needs refinement');
} else {
  console.log('❌ FAIL: Extended suite failed');
}

console.log('');
console.log('━'.repeat(80));
console.log('CATEGORY BREAKDOWN:');
console.log('━'.repeat(80));
console.log('');

categoryStats.forEach((stats, category) => {
  const catAccuracy = (stats.correct / stats.total) * 100;
  const avgConfidence = stats.confidenceScores.reduce((sum, score) => sum + score, 0) / stats.confidenceScores.length;
  console.log(`${category}:`);
  console.log(`  ${stats.correct}/${stats.total} correct (${catAccuracy.toFixed(0)}%) | Avg confidence: ${(avgConfidence * 100).toFixed(0)}%`);
  console.log('');
});

// ============================================================================
// CRITICAL EDGE CASE ANALYSIS
// ============================================================================

console.log('━'.repeat(80));
console.log('CRITICAL EDGE CASE ANALYSIS:');
console.log('━'.repeat(80));
console.log('');

const edgeCases = results.filter(r => r.testCase.criticalEdgeCase);

console.log(`Total critical edge cases: ${edgeCases.length}`);
console.log('');

edgeCases.forEach((result, i) => {
  const testCase = result.testCase;
  console.log(`${i + 1}. ${testCase.category} — ${testCase.test_id}`);
  console.log(`   Expected: ${testCase.expectedCategory} | Actual: ${result.actualCategory} | ${result.categoryMatch ? '✅' : '❌'}`);
  console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`   Notes: ${testCase.notes}`);

  if (testCase.suite_id === '9.3') {
    // Special handling for influencer boundary test
    console.log(`   ⚠️  BOUNDARY TEST: Confidence ${result.confidence.toFixed(2)} → Should route to manual if < 85%`);
    if (result.confidence < 0.85) {
      console.log(`   ✅ PASS: Correctly routed to manual (low confidence boundary)`);
    } else {
      console.log(`   ❌ FAIL: Should route to manual but confidence is too high`);
    }
  }

  console.log('');
});

// ============================================================================
// TONE CALIBRATION FAILURES (Tests 2.3, 4.3, 6.2)
// ============================================================================

console.log('━'.repeat(80));
console.log('TONE CALIBRATION ANALYSIS:');
console.log('━'.repeat(80));
console.log('');

const toneCalibrationTests = [
  { suite_id: '2.3', test_id: 'Product not as described' },
  { suite_id: '4.3', test_id: 'Return without receipt' },
  { suite_id: '6.2', test_id: 'Payment declined but money taken' }
];

const toneCalibrationResults = toneCalibrationTests.map(testRef => {
  const result = results.find(r => r.testCase.suite_id === testRef.suite_id && r.testCase.test_id === testRef.test_id);
  return {
    testCase: result.testCase,
    hasDefensiveness: result?.draft?.toLowerCase().includes('not as described') ||
                    result?.draft?.toLowerCase().includes('disappointed'),
    hasOverApology: result?.draft ? (result.draft.toLowerCase().match(/sorry/g) || []).length > 1 : false,
    lensPass: !result?.draft?.toLowerCase().includes('not as described') &&
               (result?.draft ? (result.draft.toLowerCase().match(/sorry/g) || []).length <= 1 : false)
  };
});

console.log(`Tests 2.3, 4.3, 6.2 — Brand Lens Check`);
console.log('');

toneCalibrationResults.forEach((result, i) => {
  console.log(`${i + 1}. ${result.testCase.test_id} (${result.testCase.category})`);
  console.log(`   Has defensiveness: ${result.hasDefensiveness ? '❌' : '✅'}`);
  console.log(`   Over-apologising: ${result.hasOverApology ? '❌' : '✅'}`);
  console.log(`   Brand lens: ${result.lensPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
});

// ============================================================================
// FINAL RECOMMENDATION
// ============================================================================

console.log('');
console.log('====================================================================');
console.log('  FINAL RECOMMENDATION');
console.log('====================================================================');
console.log('');
console.log('  "Would I confidently send this to a high-value Sagitine customer?"');
console.log('');
console.log(`  ${accuracy >= 90 ? 'YES - Extended suite passes' : 'NO - Needs refinement'}`);
console.log('');
console.log('====================================================================');
