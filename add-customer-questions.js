#!/usr/bin/env node
/**
 * Add customer_question fields to 24 classify.json entries
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_classification_training.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Mapping of IDs to customer_question fields
const customerQuestionMap = {
  "shipping_delivery_pre_order_proactive_update": "What's the status of my pre-order?",
  "shipping_delivery_treasure_chest_separate": "Where is my separate item shipping?",
  "shipping_delivery_order_arrived_early": "My order arrived earlier than expected",
  "shipping_delivery_click_collect_sydney": "Do you offer click and collect?",
  "shipping_delivery_discount_code_missed": "I missed the discount code at checkout",
  "order_modification_colour_change": "Can I change the colour of my order?",
  "order_modification_add_items": "Can I add something to my order?",
  "shipping_delivery_local_assembled": "Can my stand be delivered assembled?",
  "shipping_delivery_split_order_explanation": "Will my order arrive in one delivery?",
  "shipping_delivery_sendle_courier_delay": "My order is delayed due to the courier",
  "shipping_delivery_missing_hardware_pack": "I can't find the hardware in the packaging",
  "damaged_missing_screw_missing": "A screw is missing from my order",
  "product_usage_shoes_sizing": "Will my shoes fit in the Milan boxes?",
  "product_usage_no_showroom": "Can I view your products in person?",
  "product_usage_wobbling_stand": "My stand is wobbling slightly",
  "stock_availability_stand_only_pricing": "Can I buy just the stand without boxes?",
  "stock_availability_treasure_chest_gift_only": "Can I purchase the Treasure Chest separately?",
  "stock_availability_limited_edition_sold_out": "Will the limited edition colour come back?",
  "return_refund_discount_refund": "I'd like a refund of my discount",
  "return_refund_review_request_warm": "I love my pieces, just wanted to say",
  "brand_feedback_product_feedback_colour": "I have some feedback on your colours",
  "shipping_delivery_address_correction": "I need to correct my delivery address",
  "partnership_trade_pricing": "Do you offer trade or interior designer pricing?",
  "partnership_gifted_platform_redirect": "I'd love to collaborate with Sagitine"
};

// Add customer_question to entries that don't have it
let updatedCount = 0;
data.forEach(entry => {
  if (!entry.customer_question && customerQuestionMap[entry.id]) {
    entry.customer_question = customerQuestionMap[entry.id];
    entry.source = "Classify.json";
    updatedCount++;
  }
});

console.log(`✓ Updated ${updatedCount} entries with customer_question fields`);

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
console.log('✓ File saved');

// Verify
const verify = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const withCustomerQuestion = verify.filter(e => e.customer_question).length;
console.log(`✓ Verification: ${withCustomerQuestion}/${data.length} entries now have customer_question`);
