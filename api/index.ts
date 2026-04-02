// Vercel Edge Function for Sagitine AI CX Agent
import { classifyEmail } from '../src/api/services/claude-classifier';
import type { InboundEmailPayload, ClassificationAPIResponse } from '../src/api/types';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS preflight
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
          } as ClassificationAPIResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const payload: InboundEmailPayload = {
        from_email: rawBody.from_email,
        from_name: rawBody.from_name,
        subject: rawBody.subject,
        body_plain: rawBody.body_plain,
        body_html: rawBody.body_html,
        timestamp: rawBody.timestamp,
        message_id: rawBody.message_id,
        thread_id: rawBody.thread_id,
        in_reply_to: rawBody.in_reply_to,
        references: rawBody.references,
      };

      const result = await classifyEmail(payload);

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        } as ClassificationAPIResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error: any) {
      console.error('API error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        } as ClassificationAPIResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
