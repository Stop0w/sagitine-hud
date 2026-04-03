#!/usr/bin/env node
/**
 * Add missing training scenarios and negative examples
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_classification_training.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// New training scenarios to add
const newScenarios = [
  // ===== PRE_PURCHASE_QUESTION (5 scenarios) =====
  {
    id: "pre_001",
    title: "Product specifications question",
    category: "pre_purchase_question",
    customer_question: "What are the dimensions of this product?",
    scenario_label: "Customer asking about product specifications before purchase",
    body_template: "",
    tone_notes: "Helpful, informative",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "pre_002",
    title: "International shipping enquiry",
    category: "pre_purchase_question",
    customer_question: "Do you ship internationally?",
    scenario_label: "Customer asking about international shipping availability",
    body_template: "",
    tone_notes: "Clear shipping policy information",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "pre_003",
    title: "Gift purchase advice needed",
    category: "pre_purchase_question",
    customer_question: "I'm looking for a gift for my sister, what would you recommend?",
    scenario_label: "Customer asking for product recommendations for a recipient",
    body_template: "",
    tone_notes: "Warm, consultative",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "pre_004",
    title: "Product compatibility question",
    category: "pre_purchase_question",
    customer_question: "Is this suitable for outdoor use?",
    scenario_label: "Customer asking about product suitability for a use case",
    body_template: "",
    tone_notes: "Informative, reassuring",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "pre_005",
    title: "Storage capacity question",
    category: "pre_purchase_question",
    customer_question: "How much can this hold?",
    scenario_label: "Customer asking about product capacity or dimensions",
    body_template: "",
    tone_notes: "Helpful, specific",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },

  // ===== ORDER_MODIFICATION_CANCELLATION (4 scenarios) =====
  {
    id: "omc_001",
    title: "Cancel order request",
    category: "order_modification_cancellation",
    customer_question: "I need to cancel my order",
    scenario_label: "Customer wants to cancel an order recently placed",
    body_template: "",
    tone_notes: "Quick confirmation, action-oriented",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "omc_002",
    title: "Wrong address correction",
    category: "order_modification_cancellation",
    customer_question: "I need to correct the delivery address on my order",
    scenario_label: "Customer wants to change delivery address on existing order",
    body_template: "",
    tone_notes: "Urgent but calm, confirm details",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "omc_003",
    title: "Add item to order",
    category: "order_modification_cancellation",
    customer_question: "Can I add something to my order?",
    scenario_label: "Customer wants to add items to an existing order",
    body_template: "",
    tone_notes: "Helpful, check timing",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "omc_004",
    title: "Change item selected",
    category: "order_modification_cancellation",
    customer_question: "I selected the wrong item, can I change it?",
    scenario_label: "Customer wants to swap one item for another before shipping",
    body_template: "",
    tone_notes: "Solution-focused",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },

  // ===== ACCOUNT_BILLING_PAYMENT (5 scenarios) =====
  {
    id: "abp_001",
    title: "Payment declined but money taken",
    category: "account_billing_payment",
    customer_question: "My payment was declined but the money was taken from my account",
    scenario_label: "Payment dispute - money taken without order confirmation",
    body_template: "",
    tone_notes: "Urgent, reassuring, action-oriented",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "abp_002",
    title: "Can't log in to account",
    category: "account_billing_payment",
    customer_question: "I can't log in to my account",
    scenario_label: "Customer unable to access account",
    body_template: "",
    tone_notes: "Helpful, technical support",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "abp_003",
    title: "Discount code didn't apply",
    category: "account_billing_payment",
    customer_question: "My discount code didn't apply at checkout",
    scenario_label: "Promo code not working during checkout",
    body_template: "",
    tone_notes: "Apologetic, solution-focused",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "abp_004",
    title: "Duplicate charge on statement",
    category: "account_billing_payment",
    customer_question: "I was charged twice for the same order",
    scenario_label: "Duplicate payment detected",
    body_template: "",
    tone_notes: "Urgent, immediate refund assurance",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "abp_005",
    title: "Password reset not received",
    category: "account_billing_payment",
    customer_question: "I'm not receiving the password reset email",
    scenario_label: "Account access - password reset email not arriving",
    body_template: "",
    tone_notes: "Technical troubleshooting",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },

  // ===== PRAISE_TESTIMONIAL_UGC (5 scenarios) =====
  {
    id: "praise_001",
    title: "Third-party gifting praise",
    category: "praise_testimonial_ugc",
    customer_question: "I gifted this to my sister and she loves it",
    scenario_label: "Customer reporting gift recipient loved the product",
    body_template: "",
    tone_notes: "Warm, appreciative",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "praise_002",
    title: "Instagram unboxing with followers",
    category: "praise_testimonial_ugc",
    customer_question: "I featured you on my Instagram and my followers love it",
    scenario_label: "Customer sharing brand on social media with followers",
    body_template: "",
    tone_notes: "Grateful, encouraging",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "praise_003",
    title: "5-star review notification",
    category: "praise_testimonial_ugc",
    customer_question: "I left you a 5-star review",
    scenario_label: "Customer reporting they have left a positive review",
    body_template: "",
    tone_notes: "Appreciative, warm",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "praise_004",
    title: "Pure satisfaction with no request",
    category: "praise_testimonial_ugc",
    customer_question: "I'm so happy with my purchase",
    scenario_label: "Customer expressing satisfaction with no request attached",
    body_template: "",
    tone_notes: "Warm, genuine appreciation",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "praise_005",
    title: "Social handle provided",
    category: "praise_testimonial_ugc",
    customer_question: "Here's my Instagram handle if you want to see my post",
    scenario_label: "Customer providing social media handle for brand engagement",
    body_template: "",
    tone_notes: "Engaged, grateful",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },

  // ===== NEGATIVE EXAMPLES (to prevent misclassification) =====
  {
    id: "negative_001",
    title: "NEGATIVE: International shipping should NOT be brand_feedback",
    category: "brand_feedback_general",
    customer_question: "NEGATIVE_EXAMPLE: Do you ship to New Zealand?",
    scenario_label: "NEGATIVE: This is a pre-purchase question, not brand feedback",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_002",
    title: "NEGATIVE: Address correction should NOT be brand_feedback",
    category: "brand_feedback_general",
    customer_question: "NEGATIVE_EXAMPLE: I need to change my delivery address",
    scenario_label: "NEGATIVE: This is order modification, not brand feedback",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_003",
    title: "NEGATIVE: Add to order should NOT be brand_feedback",
    category: "brand_feedback_general",
    customer_question: "NEGATIVE_EXAMPLE: Can I add to my order?",
    scenario_label: "NEGATIVE: This is order modification, not brand feedback",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_004",
    title: "NEGATIVE: Follow-up should NOT be brand_feedback",
    category: "brand_feedback_general",
    customer_question: "NEGATIVE_EXAMPLE: Following up on my previous email",
    scenario_label: "NEGATIVE: This is other_uncategorized, not brand feedback",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_005",
    title: "NEGATIVE: Payment dispute should NOT be damaged_missing",
    category: "damaged_missing_faulty",
    customer_question: "NEGATIVE_EXAMPLE: Payment taken but no order confirmed",
    scenario_label: "NEGATIVE: This is account billing, not damaged/missing",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_006",
    title: "NEGATIVE: Login issue should NOT be damaged_missing",
    category: "damaged_missing_faulty",
    customer_question: "NEGATIVE_EXAMPLE: Can't log in to my account",
    scenario_label: "NEGATIVE: This is account billing, not damaged/missing",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_007",
    title: "NEGATIVE: Discount code should NOT be order_modification",
    category: "order_modification_cancellation",
    customer_question: "NEGATIVE_EXAMPLE: Discount code didn't apply at checkout",
    scenario_label: "NEGATIVE: This is account billing, not order modification",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_008",
    title: "NEGATIVE: Gift advice should NOT be partnership",
    category: "partnership_wholesale_press",
    customer_question: "NEGATIVE_EXAMPLE: I'm looking for a gift for my sister",
    scenario_label: "NEGATIVE: This is pre-purchase, not partnership",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  }
];

// Add all new scenarios
data.push(...newScenarios);

console.log(`✓ Added ${newScenarios.length} new training scenarios`);

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
console.log('✓ File saved');

// Verification
const verify = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
console.log(`✓ Verification: ${verify.length} total scenarios in training data`);

// Count by category
const categoryCounts = {};
verify.forEach(entry => {
  if (entry.is_active !== false) {  // Only count active scenarios
    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
  }
});

console.log('\n📊 Active scenarios by category:');
Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count}`);
});
