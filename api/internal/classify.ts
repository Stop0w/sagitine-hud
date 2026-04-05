// @ts-nocheck
// Enhanced email classification for Make.com workflow - Using raw SQL
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

function classifyEmail(payload: any) {
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
  if (subject.includes('cancel') || body.includes('cancel my order')) {
    category = 'order_modification_cancellation';
    urgency = 10;
    riskLevel = 'high';
    intent = 'Customer wants to cancel their order';
    action = 'Check order status and assist with cancellation immediately';
    safeToAutoSend = false;
  }
  else if (subject.includes('damaged') || subject.includes('dent') || subject.includes('broken') || subject.includes('faulty')) {
    category = 'damaged_missing_faulty';
    urgency = 10;
    riskLevel = 'medium';
    intent = 'Customer reports damaged item and requests replacement';
    action = 'Request photo evidence and arrange replacement shipment';
    safeToAutoSend = false;
  }
  else if (subject.includes('return') || subject.includes('refund') || subject.includes('exchange')) {
    category = 'return_refund_exchange';
    urgency = 9;
    riskLevel = 'medium';
    intent = 'Customer wants to return or exchange item';
    action = 'Process return request according to policy';
    safeToAutoSend = false;
  }
  else if (subject.includes('delivery') || subject.includes('shipping') || body.includes('tracking')) {
    category = 'shipping_delivery_order_issue';
    urgency = 9;
    riskLevel = 'low';
    intent = 'Customer inquiring about delivery status or tracking';
    action = 'Provide tracking information and estimated delivery date';
    safeToAutoSend = true;
  }
  else if (subject.includes('payment') || subject.includes('billing') || body.includes('invoice') || body.includes('charge')) {
    category = 'account_billing_payment';
    urgency = 8;
    riskLevel = 'medium';
    intent = 'Customer has payment or billing question';
    action = 'Review payment details and assist with billing issue';
    safeToAutoSend = false;
  }
  else if (subject.includes('stock') || body.includes('available') || body.includes('backorder')) {
    category = 'stock_availability';
    urgency = 6;
    riskLevel = 'low';
    intent = 'Customer asking about product availability';
    action = 'Check stock levels and provide availability information';
    safeToAutoSend = true;
  }
  else if (subject.includes('how to') || subject.includes('assembly') || subject.includes('instruction')) {
    category = 'product_usage_guidance';
    urgency = 5;
    riskLevel = 'low';
    intent = 'Customer needs help using the product';
    action = 'Provide assembly instructions or usage guidance';
    safeToAutoSend = true;
  }
  else if (subject.includes('before buying') || subject.includes('pre-purchase') || subject.includes('thinking of buying')) {
    category = 'pre_purchase_question';
    urgency = 7;
    riskLevel = 'low';
    intent = 'Potential customer has pre-purchase questions';
    action = 'Answer product questions to support purchase decision';
    safeToAutoSend = true;
  }
  else if (subject.includes('thank') || subject.includes('love') || subject.includes('amazing') || subject.includes('great')) {
    category = 'praise_testimonial_ugc';
    urgency = 2;
    riskLevel = 'low';
    intent = 'Customer sharing positive feedback or praise';
    action = 'Thank customer and acknowledge their feedback';
    safeToAutoSend = true;
  }
  else if (subject.includes('inquiry') || subject.includes('wholesale') || subject.includes('press')) {
    category = 'partnership_wholesale_press';
    urgency = 3;
    riskLevel = 'low';
    intent = 'Business or partnership inquiry';
    action = 'Evaluate partnership opportunity and respond appropriately';
    safeToAutoSend = false;
  }

  // Generate response
  const cleanSubject = payload.subject.startsWith('Re:') ? payload.subject : 'Re: ' + payload.subject;

  return {
    category_primary: category,
    confidence: 0.75,
    urgency,
    risk_level: riskLevel,
    risk_flags: ['mock_enhanced_keyword_based'],
    customer_intent_summary: intent,
    recommended_next_action: action,
    safe_to_auto_draft: true,
    safe_to_auto_send: safeToAutoSend,
    retrieved_knowledge_ids: [],
    reply_subject: cleanSubject,
    reply_body: 'Hi ' + customerName + ',\n\nThank you for your message. I\'ve received your inquiry and I\'ll get back to you shortly with a personalised response.\n\nWarm regards,\nHeidi x',
  };
}

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = req.body;

    // Basic validation
    if (!rawBody.from_email || !rawBody.subject || !rawBody.body_plain || !rawBody.timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from_email, subject, body_plain, timestamp',
        timestamp: new Date().toISOString(),
      });
    }

    const payload = {
      from_email: rawBody.from_email,
      from_name: rawBody.from_name,
      subject: rawBody.subject,
      body_plain: rawBody.body_plain,
      body_html: rawBody.body_html,
      timestamp: rawBody.timestamp,
      message_id: rawBody.message_id,
      thread_id: rawBody.thread_id,
    };

    const sql = neon(process.env.DATABASE_URL!);

    // ============================================================================
    // STEP 1: Store inbound_email FIRST (never lose raw data)
    // ============================================================================
    const insertResult = await sql`
      INSERT INTO inbound_emails
        (source_message_id, source_thread_id, from_email, from_name, subject, body_plain, body_html, received_at)
      VALUES (
        ${payload.message_id},
        ${payload.thread_id},
        ${payload.from_email},
        ${payload.from_name || null},
        ${payload.subject},
        ${payload.body_plain},
        ${payload.body_html || null},
        ${new Date(payload.timestamp)}
      )
      ON CONFLICT (source_message_id) DO NOTHING
      RETURNING id, source_message_id, created_at
    `;

    // If email already exists (duplicate trigger), return early
    if (!insertResult || insertResult.length === 0) {
      return res.status(200).json({
        success: true,
        email_id: null,
        triage_result_id: null,
        ticket_id: null,
        duplicate: true,
        message: 'Email already processed',
        timestamp: new Date().toISOString(),
      });
    }

    const inboundEmail = insertResult[0];

    // ============================================================================
    // STEP 2: Run classification
    // ============================================================================
    const classification = classifyEmail(payload);

    // ============================================================================
    // STEP 3: Store triage_result
    // ============================================================================
    const triageResult = await sql`
      INSERT INTO triage_results
        (email_id, category_primary, confidence, urgency, risk_level, risk_flags,
         customer_intent_summary, recommended_next_action, safe_to_auto_draft,
         safe_to_auto_send, reply_subject, reply_body, retrieved_knowledge_ids, is_mock)
      VALUES (
        ${inboundEmail.id},
        ${classification.category_primary},
        ${classification.confidence},
        ${classification.urgency},
        ${classification.risk_level},
        ${JSON.stringify(classification.risk_flags || [])},
        ${classification.customer_intent_summary},
        ${classification.recommended_next_action},
        ${classification.safe_to_auto_draft},
        ${classification.safe_to_auto_send},
        ${classification.reply_subject},
        ${classification.reply_body || null},
        ${JSON.stringify(classification.retrieved_knowledge_ids || [])},
        true
      )
      RETURNING id, category_primary, urgency
    `;

    // ============================================================================
    // STEP 4: Create ticket
    // ============================================================================
    const ticket = await sql`
      INSERT INTO tickets (email_id, triage_result_id, status, send_status)
      VALUES (${inboundEmail.id}, ${triageResult[0].id}, 'classified', 'not_applicable')
      RETURNING id, status, send_status, created_at
    `;

    // ============================================================================
    // STEP 5: Return success
    // ============================================================================
    return res.status(200).json({
      success: true,
      email_id: inboundEmail.id,
      triage_result_id: triageResult[0].id,
      ticket_id: ticket[0].id,
      message: 'Ticket created successfully',
      data: classification,
      timestamp: new Date().toISOString(),
      _mode: 'mock_enhanced',
    });

  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
