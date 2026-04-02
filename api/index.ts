// Self-contained Vercel Serverless Function for Sagitine AI CX Agent

// Simple in-memory classifier for testing
async function classifyEmailSimple(payload: any) {
  const { subject, body_plain } = payload;
  const text = `${subject} ${body_plain}`.toLowerCase();

  // Simple keyword-based classification
  if (text.includes('collaboration') && text.includes('revenue') && text.includes('call')) {
    return {
      category_primary: 'spam_solicitation',
      confidence: 0.9,
      urgency: 2,
      risk_level: 'low' as const,
      customer_intent_summary: 'Spam collaboration solicitation',
      recommended_next_action: 'Ignore or mark as spam',
      safe_to_auto_draft: false,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: null,
    };
  }

  // Default fallback
  return {
    category_primary: 'brand_feedback_general',
    confidence: 0.5,
    urgency: 5,
    risk_level: 'medium' as const,
    customer_intent_summary: 'Customer inquiry',
    recommended_next_action: 'Review and respond',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: [],
    reply_subject: `Re: ${subject}`,
    reply_body: `Hi,\n\nThank you for your message. We'll review your inquiry and get back to you shortly.\n\nWarm regards,\nSagitine Team`,
  };
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET /api/health
  if (req.method === 'GET' && path === '/api/health') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'sagitine-ai-cx-agent',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        env_test: process.env.ANTHROPIC_API_KEY ? 'API_KEY_EXISTS' : 'NO_API_KEY',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // GET /api/categories
  if (req.method === 'GET' && path === '/api/categories') {
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

  // POST /api/classify
  if (req.method === 'POST' && path === '/api/classify') {
    try {
      const rawBody = await req.json();

      // Basic validation
      if (!rawBody.from_email || !rawBody.subject || !rawBody.body_plain || !rawBody.timestamp) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields: from_email, subject, body_plain, timestamp',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const result = await classifyEmailSimple(rawBody);

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Not found' }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
