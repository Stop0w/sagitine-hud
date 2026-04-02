// GET /api/categories - List Categories Endpoint

export default async function handler(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      categories: [
        { id: 'damaged_missing_faulty', label: 'Damaged/Missing/Faulty', urgency_default: 10 },
        { id: 'shipping_delivery_order_issue', label: 'Shipping/Delivery', urgency_default: 9 },
        { id: 'product_usage_guidance', label: 'Product Usage', urgency_default: 8 },
        { id: 'pre_purchase_question', label: 'Pre-Purchase', urgency_default: 7 },
        { id: 'return_refund_exchange', label: 'Return/Refund/Exchange', urgency_default: 9 },
        { id: 'stock_availability', label: 'Stock Availability', urgency_default: 6 },
        { id: 'partnership_wholesale_press', label: 'Partnership/Press', urgency_default: 3 },
        { id: 'brand_feedback_general', label: 'Brand Feedback', urgency_default: 2 },
        { id: 'spam_solicitation', label: 'Spam/Solicitation', urgency_default: 1 },
      ],
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
