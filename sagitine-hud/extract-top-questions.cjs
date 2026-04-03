const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('./data/classified/classified_sent_emails.json', 'utf8'));

// Group by category
const byCategory = {};

data.forEach(email => {
  const cat = email.category;
  if (!byCategory[cat]) {
    byCategory[cat] = [];
  }
  byCategory[cat].push({
    subject: email.subject,
    question: email.customer_question,
    quality: email.response_quality_score || 0
  });
});

// Sort each category by quality score
Object.keys(byCategory).forEach(category => {
  byCategory[category].sort((a, b) => b.quality - a.quality);
});

// Top 7 questions per category
const categories = [
  'damaged_missing_faulty',
  'shipping_delivery_order_issue',
  'product_usage_guidance',
  'stock_availability',
  'return_refund_exchange',
  'partnership_wholesale_press',
  'pre_purchase_question',
  'brand_feedback_general'
];

console.log('=== TOP 7 CUSTOMER QUESTIONS BY CATEGORY ===\n');

categories.forEach(category => {
  if (byCategory[category] && byCategory[category].length > 0) {
    console.log(`## ${category.toUpperCase()}`);
    console.log(`Total emails: ${byCategory[category].length}\n`);

    const top7 = byCategory[category].slice(0, 7);
    top7.forEach((item, idx) => {
      console.log(`${idx + 1}. Subject: "${item.subject}"`);
      console.log(`   Question: "${item.question}"`);
      console.log(`   Quality Score: ${item.quality}/10`);
      console.log('');
    });
    console.log('---\n');
  }
});
