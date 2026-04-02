// Self-contained email classification for Make.com
// Zero external dependencies - works within Vercel serverless limits

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
}

function classifyEmail(payload: any): ClassificationResult {
  const { from_email, subject, body_plain, from_name } = payload;
  const text = `${subject} ${body_plain}`.toLowerCase();
  const customerName = from_name || 'Customer';

  // Spam detection (highest priority)
  if (
    text.includes('collaboration') ||
    text.includes('revenue') && text.includes('guaranteed') ||
    text.includes('10x') && text.includes('revenue') ||
    (text.includes('call') && text.includes('jump on a call')) ||
    text.includes('outreach') && text.includes('guaranteed')
  ) {
    return {
      category_primary: 'spam_solicitation',
      confidence: 0.95,
      urgency: 1,
      risk_level: 'low',
      customer_intent_summary: 'Spam/cold outreach solicitation',
      recommended_next_action: 'Ignore or mark as spam',
      safe_to_auto_draft: false,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: '',
      reply_body: null,
    };
  }

  // Damaged/missing/faulty
  if (
    text.includes('damaged') ||
    text.includes('broken') ||
    text.includes('faulty') ||
    text.includes('defective') ||
    text.includes('missing') ||
    text.includes('not received') ||
    text.includes('never arrived')
  ) {
    return {
      category_primary: 'damaged_missing_faulty',
      confidence: 0.9,
      urgency: 10,
      risk_level: 'high',
      customer_intent_summary: 'Customer reports damaged, missing, or faulty item',
      recommended_next_action: 'Arrange replacement or refund',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: `Hi ${customerName},\n\nI'm so sorry to hear that your item arrived damaged! That's definitely not what we want.\n\nCould you please share a photo of the damage and your order number? We'll get a replacement sorted out for you right away.\n\nWarm regards,\nSagitine Team`,
    };
  }

  // Shipping/delivery issues
  if (
    text.includes('shipping') ||
    text.includes('delivery') ||
    text.includes('where is my order') ||
    text.includes('when will it arrive') ||
    text.includes('order status') ||
    text.includes('package') && text.includes('late')
  ) {
    return {
      category_primary: 'shipping_delivery_order_issue',
      confidence: 0.85,
      urgency: 9,
      risk_level: 'medium',
      customer_intent_summary: 'Shipping or delivery inquiry',
      recommended_next_action: 'Check order status and provide update',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: `Hi ${customerName},\n\nThank you for reaching out about your order.\n\nI'm checking on the status of your shipment right now and will get back to you shortly with an update.\n\nWarm regards,\nSagitine Team`,
    };
  }

  // Returns/refunds
  if (
    text.includes('return') ||
    text.includes('refund') ||
    text.includes('money back') ||
    text.includes('send back') ||
    text.includes('exchange') ||
    text.includes('not satisfied')
  ) {
    return {
      category_primary: 'return_refund_exchange',
      confidence: 0.9,
      urgency: 9,
      risk_level: 'medium',
      customer_intent_summary: 'Return or refund request',
      recommended_next_action: 'Process return/refund according to policy',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: `Hi ${customerName},\n\nThank you for reaching out about a return.\n\nCould you please provide your order number and let us know what you'd like to return? We'll review your request and get back to you within 1-2 business days.\n\nWarm regards,\nSagitine Team`,
    };
  }

  // Product usage guidance
  if (
    text.includes('how') ||
    text.includes('how do') ||
    text.includes('instructions') ||
    text.includes('usage') ||
    text.includes('use the') ||
    text.includes('working') ||
    text.includes('what do')
  ) {
    return {
      category_primary: 'product_usage_guidance',
      confidence: 0.8,
      urgency: 6,
      risk_level: 'low',
      customer_intent_summary: 'Product usage question',
      recommended_next_action: 'Provide usage instructions',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: `Hi ${customerName},\n\nGreat question! Here's how to use our product:\n\n[Insert usage instructions here]\n\nHope this helps! Let me know if you have any other questions.\n\nWarm regards,\nSagitine Team`,
    };
  }

  // Pre-purchase questions
  if (
    text.includes('before') ||
    text.includes('thinking about') ||
    text.includes('interested in') ||
    text.includes('pre-order') ||
    text.includes('coming soon') ||
    text.includes('available yet')
  ) {
    return {
      category_primary: 'pre_purchase_question',
      confidence: 0.75,
      urgency: 5,
      risk_level: 'low',
      customer_intent_summary: 'Pre-purchase inquiry',
      recommended_next_action: 'Answer questions and encourage purchase',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: `Hi ${customerName},\n\nThanks for your interest! We'd be happy to help answer any questions you have.\n\nWhat would you like to know about our products?\n\nWarm regards,\nSagitine Team`,
    };
  }

  // Stock inquiries
  if (
    text.includes('stock') ||
    text.includes('in stock') ||
    text.includes('available') ||
    text.includes('when will it be') ||
    text.includes('restock')
  ) {
    return {
      category_primary: 'stock_availability',
      confidence: 0.8,
      urgency: 6,
      risk_level: 'low',
      customer_intent_summary: 'Stock availability inquiry',
      recommended_next_action: 'Check stock levels and provide ETA',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: `Hi ${customerName},\n\nThanks for checking on stock availability.\n\nLet me check our current inventory and get back to you shortly with an update.\n\nWarm regards,\nSagitine Team`,
    };
  }

  // Partnership/wholesale/press
  if (
    text.includes('wholesale') ||
    text.includes('reseller') ||
    text.includes('press') ||
    text.includes('partnership') ||
    text.includes('collaborate') && !text.includes('revenue')
  ) {
    return {
      category_primary: 'partnership_wholesale_press',
      confidence: 0.85,
      urgency: 4,
      risk_level: 'low',
      customer_intent_summary: 'Partnership or wholesale inquiry',
      recommended_next_action: 'Forward to appropriate team',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: `Hi ${customerName},\n\nThanks for reaching out to us.\n\nThis type of inquiry is forwarded to our partnerships team. We'll be in touch shortly.\n\nWarm regards,\nSagitine Team`,
    };
  }

  // Order modifications/cancellations
  if (
    text.includes('cancel') ||
    text.includes('modification') ||
    text.includes('change my order') ||
    text.includes('different size') ||
    text.includes('wrong item')
  ) {
    return {
      category_primary: 'order_modification_cancellation',
      confidence: 0.85,
      urgency: 7,
      risk_level: 'medium',
      customer_intent_summary: 'Order modification or cancellation request',
      recommended_next_action: 'Check order status and assist with changes',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${subject}`,
      reply_body: `Hi ${customerName},\n\nI can certainly help you with modifying your order.\n\nCould you please provide your order number and let me know what changes you'd like to make?\n\nWarm regards,\nSagitine Team`,
    };
  }

  // Default: brand feedback
  return {
    category_primary: 'brand_feedback_general',
    confidence: 0.5,
    urgency: 5,
    risk_level: 'low',
    customer_intent_summary: 'General customer feedback',
    recommended_next_action: 'Review and respond appropriately',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: [],
    reply_subject: `Re: ${subject}`,
    reply_body: `Hi ${customerName},\n\nThank you for your message!\n\nWe'll review your inquiry and get back to you within 1-2 business days.\n\nWarm regards,\nSagitine Team`,
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
