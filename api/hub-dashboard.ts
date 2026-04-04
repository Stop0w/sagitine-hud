// @ts-nocheck
// Hub Dashboard API - Combined metrics + categories for single-poll optimisation

export const config = {
  runtime: 'nodejs',
};

const CATEGORY_LABELS: Record<string, string> = {
  damaged_missing_faulty: 'Damaged & Faulty',
  shipping_delivery_order_issue: 'Shipping & Delivery',
  product_usage_guidance: 'Product Usage',
  pre_purchase_question: 'Pre-Purchase',
  return_refund_exchange: 'Return & Refund',
  stock_availability: 'Stock Availability',
  partnership_wholesale_press: 'Partnership & Press',
  brand_feedback_general: 'Brand Feedback',
  spam_solicitation: 'Spam & Solicitation',
  other_uncategorized: 'Other',
  account_billing_payment: 'Account & Billing',
  order_modification_cancellation: 'Order Modification',
  praise_testimonial_ugc: 'Praise & Feedback',
};

function getCategoryLabel(categoryEnum: string): string {
  return CATEGORY_LABELS[categoryEnum] || categoryEnum;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: Re-enable database queries once src/db import issue is resolved
  // For now, return safe empty state to prevent UI flickering
  return res.status(200).json({
    success: true,
    data: {
      total_queue: 0,
      urgent_count: 0,
      sent_today: 0,
      pending_review: 0,
      approved: 0,
      rejected: 0,
      queue: [],
      categories: Object.keys(CATEGORY_LABELS).map(categoryEnum => ({
        category: categoryEnum,
        categoryLabel: getCategoryLabel(categoryEnum),
        count: 0,
        urgency: 'low',
        avgConfidence: 0,
      })),
      _timezone: 'Australia/Sydney',
      _fallback: true,
      _message: 'Database temporarily unavailable - using mock data while fixing Vercel import issue'
    },
    timestamp: new Date().toISOString(),
  });
}
