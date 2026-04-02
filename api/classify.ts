// Enhanced mock classification for Make.com workflow
// Uses keyword-based logic until proper bundling is configured

interface ClassificationResult {
  category_primary: string;
  confidence: number;
  urgency: number;
  risk_level: 'low' | 'medium' | 'high';
  customer_intent_summary: string;
  recommended_next_action: string;
  safe_to_auto_draft: boolean;
  safe_to_auto_send: boolean;
  retrieved_knowledge_ids: string[];
  reply_subject: string;
  reply_body: string | null;
  ticket_id?: string;
  customer_profile_id?: string;
}

function classifyEmail(payload: any): ClassificationResult {
  const customerName = payload.from_name || 'Customer';
  const subject = payload.subject.toLowerCase();
  const body = payload.body_plain.toLowerCase();

  // Initialize with defaults
  let category = 'brand_feedback_general';
  let urgency = 5;
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  let intent = 'Customer inquiry';
  let action = 'Review and respond appropriately';
  let safeToAutoSend = false;

  // Classification logic (keyword-based)
  if (
    subject.includes('cancel') ||
    body.includes('cancel my order') ||
    subject.includes('modification') ||
    body.includes('change my order')
  ) {
    category = 'order_modification_cancellation';
    urgency = 7;
    action = 'Review cancellation request and check order status';
  } else if (
    subject.includes('damaged') ||
    body.includes('damaged') ||
    subject.includes('broken') ||
    body.includes('broken') ||
    subject.includes('faulty') ||
    body.includes('defective') ||
    subject.includes('missing') ||
    body.includes('missing item')
  ) {
    category = 'damaged_missing_faulty';
    urgency = 10;
    riskLevel = 'high';
    action = 'Arrange replacement or refund';
  } else if (
    subject.includes('shipping') ||
    body.includes('shipping') ||
    subject.includes('delivery') ||
    body.includes('delivery') ||
    subject.includes('where is my order') ||
    body.includes('when will it arrive')
  ) {
    category = 'shipping_delivery_order_issue';
    urgency = 9;
    riskLevel = 'medium';
    action = 'Check order status and provide update';
  } else if (
    subject.includes('how') ||
    body.includes('how do') ||
    subject.includes('instructions') ||
    body.includes('usage') ||
    subject.includes('use the') ||
    body.includes('working')
  ) {
    category = 'product_usage_guidance';
    urgency = 6;
    action = 'Provide usage instructions';
  } else if (
    subject.includes('before') ||
    body.includes('before ordering') ||
    subject.includes('thinking about') ||
    body.includes('interested in') ||
    subject.includes('pre-order') ||
    body.includes('coming soon')
  ) {
    category = 'pre_purchase_question';
    urgency = 5;
    action = 'Answer product questions and encourage purchase';
  } else if (
    subject.includes('return') ||
    body.includes('return') ||
    subject.includes('refund') ||
    body.includes('money back') ||
    body.includes('get my money back')
  ) {
    category = 'return_refund_exchange';
    urgency = 9;
    riskLevel = 'medium';
    action = 'Process return/refund request';
  } else if (
    subject.includes('stock') ||
    body.includes('in stock') ||
    subject.includes('available') ||
    body.includes('when will it be back')
  ) {
    category = 'stock_availability';
    urgency = 6;
    action = 'Check stock levels and provide ETA';
  } else if (
    subject.includes('collaboration') ||
    body.includes('partnership') ||
    subject.includes('revenue') && body.includes('guaranteed') ||
    subject.includes('10x') && body.includes('revenue') ||
    (subject.includes('call') && body.includes('jump on a call'))
  ) {
    category = 'spam_solicitation';
    urgency = 1;
    riskLevel = 'low';
    intent = 'Spam/cold outreach';
    action = 'Ignore or mark as spam';
    safeToAutoSend = true;
  } else if (
    subject.includes('wholesale') ||
    body.includes('reseller') ||
    subject.includes('press') ||
    body.includes('inquiry about')
  ) {
    category = 'partnership_wholesale_press';
    urgency = 4;
    action = 'Forward to appropriate team';
  }

  return {
    category_primary: category,
    confidence: 0.85,
    urgency,
    risk_level: riskLevel,
    customer_intent_summary: intent,
    recommended_next_action: action,
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: [],
    reply_subject: `Re: ${payload.subject}`,
    reply_body: `Hi ${customerName},\n\nThank you for reaching out to us.\n\n${action === 'Ignore or mark as spam' ? '' : `We'll review your message and get back to you within 1-2 business days.\n\nWarm regards,\nSagitine Team`}`,
  };
}

export default async function handler(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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

    const result = classifyEmail(rawBody);

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
