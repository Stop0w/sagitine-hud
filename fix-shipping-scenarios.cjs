#!/usr/bin/env node
/**
 * Fix shipping/damaged conflict and add missing scenarios
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_classification_training.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Fix dmf_001 - change pattern to be more specific to MISSING items, not WHERE IS queries
const dmf001 = data.find(entry => entry.id === 'dmf_001');
if (dmf001) {
  dmf001.customer_question = "Parts are missing from my order";
  dmf001.scenario_label = "Customer reports missing components from received order";
  console.log('✓ Fixed dmf_001 pattern to focus on missing parts');
}

// Fix ship_016 - make it more specific to COURIER delivery errors, not customer address typos
const ship016 = data.find(entry => entry.id === 'ship_016');
if (ship016) {
  ship016.customer_question = "The courier delivered my order to the wrong address";
  ship016.scenario_label = "Courier delivery error - delivered to incorrect address";
  console.log('✓ Fixed ship_016 pattern to focus on courier delivery errors');
}

// Add specific shipping scenarios
const shippingScenarios = [
  {
    id: "ship_015",
    title: "Where is my parcel",
    category: "shipping_delivery_order_issue",
    customer_question: "Where is my parcel?",
    scenario_label: "Customer asking for parcel location with tracking",
    body_template: "",
    tone_notes: "Provide tracking, helpful",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "ship_016",
    title: "Delivered to wrong address",
    category: "shipping_delivery_order_issue",
    customer_question: "My order was delivered to the wrong address",
    scenario_label: "Delivery address error - courier delivered incorrectly",
    body_template: "",
    tone_notes: "Urgent, action-oriented",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "ship_017",
    title: "Gift timing urgency",
    category: "shipping_delivery_order_issue",
    customer_question: "My gift needs to arrive by Friday, can you guarantee delivery?",
    scenario_label: "Time-sensitive gift order with delivery deadline",
    body_template: "",
    tone_notes: "Reassuring, specific about timing",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "ship_018",
    title: "Tracking not updating",
    category: "shipping_delivery_order_issue",
    customer_question: "My tracking hasn't updated in days",
    scenario_label: "Tracking link stuck or not updating",
    body_template: "",
    tone_notes: "Investigate, follow up with courier",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "ship_019",
    title: "Delivery delay notification",
    category: "shipping_delivery_order_issue",
    customer_question: "I received a delay notification, when will my order arrive?",
    scenario_label: "Customer responding to shipping delay notification",
    body_template: "",
    tone_notes: "Apologetic, give new timeline",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  }
];

// Add return_refund_exchange scenarios
const returnScenarios = [
  {
    id: "return_009",
    title: "Return without receipt",
    category: "return_refund_exchange",
    customer_question: "I received this as a gift but don't have the receipt, can I return it?",
    scenario_label: "Gift return without receipt - adds complexity",
    body_template: "",
    tone_notes: "Helpful, explain gift return policy",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "return_010",
    title: "Refund status follow-up",
    category: "return_refund_exchange",
    customer_question: "What's the status of my refund?",
    scenario_label: "Customer following up on refund processing status",
    body_template: "",
    tone_notes: "Check status, give timeline",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  }
];

// Add partnership scenarios
const partnershipScenarios = [
  {
    id: "partner_009",
    title: "Gift hamper collaboration",
    category: "partnership_wholesale_press",
    customer_question: "We're creating gift hampers and would love to feature your products",
    scenario_label: "Business collaboration request for gift hampers",
    body_template: "",
    tone_notes: "Professional, evaluate opportunity",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "partner_010",
    title: "Press enquiry",
    category: "partnership_wholesale_press",
    customer_question: "I'm writing a feature article and would like to include your products",
    scenario_label: "Media/press enquiry for editorial feature",
    body_template: "",
    tone_notes: "Excited, provide information",
    is_active: true,
    quality_score: 10,
    synthesized: false,
    source: "test_scenario"
  }
];

// Add spam scenarios
const spamScenarios = [
  {
    id: "spam_004",
    title: "Vendor services solicitation",
    category: "spam_solicitation",
    customer_question: "We build websites for ecommerce brands",
    scenario_label: "B2B service provider cold outreach",
    body_template: "",
    tone_notes: "Ignore or mark as spam",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "test_scenario"
  },
  {
    id: "spam_005",
    title: "SEO audit fear hook",
    category: "spam_solicitation",
    customer_question: "Your site is losing traffic, we can help",
    scenario_label: "SEO agency using fear-based cold outreach",
    body_template: "",
    tone_notes: "Ignore or mark as spam",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "test_scenario"
  }
];

// Negative examples to prevent cross-category matching
const negativeExamples = [
  {
    id: "negative_009",
    title: "NEGATIVE: Address correction before shipping is NOT delivery issue",
    category: "shipping_delivery_order_issue",
    customer_question: "NEGATIVE_EXAMPLE: I entered the wrong address at checkout, can you fix it?",
    scenario_label: "NEGATIVE: This is order modification, not shipping delivery issue",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_010",
    title: "NEGATIVE: Gift hamper collaboration is NOT spam",
    category: "spam_solicitation",
    customer_question: "NEGATIVE_EXAMPLE: We're creating gift hampers for our clients",
    scenario_label: "NEGATIVE: This is partnership enquiry, not spam",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  },
  {
    id: "negative_011",
    title: "NEGATIVE: Third-party gift praise is NOT brand feedback",
    category: "brand_feedback_general",
    customer_question: "NEGATIVE_EXAMPLE: My sister loved her gift",
    scenario_label: "NEGATIVE: This is praise/testimonial, not general brand feedback",
    body_template: "",
    tone_notes: "NEGATIVE EXAMPLE - Do not match",
    is_active: false,
    quality_score: 0,
    synthesized: false,
    source: "negative_example"
  }
];

// Add all new scenarios
data.push(...shippingScenarios, ...returnScenarios, ...partnershipScenarios, ...spamScenarios, ...negativeExamples);

console.log(`✓ Added ${shippingScenarios.length + returnScenarios.length + partnershipScenarios.length + spamScenarios.length + negativeExamples.length} additional scenarios`);

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
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
