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
  const cleanSubject = payload.subject.startsWith('Re:') ? payload.subject : `Re: ${payload.subject}`;

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
    reply_body: `Hi ${customerName},\n\nThank you for your message. I've received your inquiry and I'll get back to you shortly with a personalised response.\n\nWarm regards,\nHeidi x`,
  };
}

export default async function handler(req, res) {
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
      in_reply_to: rawBody.in_reply_to,
      references: rawBody.references,
    };

    const sql = neon(process.env.DATABASE_URL!);

    // ============================================================================
    // STEP 0: Find or create customer profile
    // ============================================================================
    const [existingProfile] = await sql`
      SELECT id, email, total_contact_count, damaged_issue_count, delivery_issue_count,
             usage_guidance_count, pre_purchase_count, return_refund_count, stock_question_count,
             praise_ugc_count, lifetime_issue_count, lifetime_positive_feedback_count
      FROM customer_profiles
      WHERE email = ${payload.from_email}
      LIMIT 1
    `;

    let customerProfileId;
    let isNewCustomer = false;

    if (!existingProfile) {
      // Create new profile
      const [newProfile] = await sql`
        INSERT INTO customer_profiles (email, name, first_contact_at, last_contact_at, total_contact_count)
        VALUES (${payload.from_email}, ${payload.from_name || null}, NOW(), NOW(), 1)
        RETURNING id, total_contact_count
      `;
      customerProfileId = newProfile.id;
      isNewCustomer = true;
    } else {
      customerProfileId = existingProfile.id;
      isNewCustomer = false;
    }

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

    // If email already exists (duplicate trigger), return existing record
    if (!insertResult || insertResult.length === 0) {
      // Fetch the existing email to return to caller
      const [existing] = await sql`
        SELECT id, triage_result_id, ticket_id
        FROM inbound_emails
        WHERE source_message_id = ${payload.message_id}
        LIMIT 1
      `;

      if (existing) {
        return res.status(200).json({
          success: true,
          email_id: existing.id,
          triage_result_id: existing.triage_result_id,
          ticket_id: existing.ticket_id,
          duplicate: true,
          message: 'Email already processed - returning existing record',
          timestamp: new Date().toISOString(),
          _mode: 'mock_enhanced',
        });
      }
    }

    const [inboundEmail] = insertResult;

    // ============================================================================
    // STEP 2: Run classification
    ============================================================================
    const classification = classifyEmail(payload);

    // ============================================================================
    // STEP 3: Store triage_result
    ============================================================================
    const [triageResult] = await sql`
      INSERT INTO triage_results
        (email_id, category_primary, confidence, urgency, risk_level, risk_flags,
         customer_intent_summary, recommended_next_action, safe_to_auto_draft, safe_to_auto_send,
         reply_subject, reply_body, retrieved_knowledge_ids, is_mock)
      VALUES (
        ${inboundEmail.id},
        ${classification.category_primary},
        ${classification.confidence},
        ${classification.urgency},
        ${classification.risk_level},
        ${classification.risk_flags || []},
        ${classification.customer_intent_summary},
        ${classification.recommended_next_action},
        ${classification.safe_to_auto_draft},
        ${classification.safe_to_auto_send},
        ${classification.reply_subject},
        ${classification.reply_body || null},
        ${classification.retrieved_knowledge_ids || []},
        true
      )
      RETURNING id, category_primary, urgency
    `;

    // ============================================================================
    // STEP 4: Create ticket in workflow state
    ============================================================================
    const [ticket] = await sql`
      INSERT INTO tickets (email_id, triage_result_id, status, send_status)
      VALUES (${inboundEmail.id}, ${triageResult.id}, 'classified', 'not_applicable')
      RETURNING id, status, send_status, created_at
    `;

    // ============================================================================
    // STEP 5: Record inbound customer contact fact
    ============================================================================
    await sql`
      INSERT INTO customer_contact_facts
        (customer_profile_id, ticket_id, email_id, channel, direction,
         contact_at, category, urgency, risk_level, status, resolution_type,
         was_human_reviewed)
      VALUES (
        ${customerProfileId},
        ${ticket.id},
        ${inboundEmail.id},
        'email',
        'inbound',
        NOW(),
        ${classification.category_primary},
        ${classification.urgency},
        ${classification.risk_level},
        'pending',
        null,
        false
      )
    `;

    // ============================================================================
    // STEP 6: Update customer profile rollups
    ============================================================================

    // Get current category counts
    const profile = await sql`
      SELECT damaged_issue_count, delivery_issue_count, usage_guidance_count,
             pre_purchase_count, return_refund_count, stock_question_count, praise_ugc_count
      FROM customer_profiles
      WHERE id = ${customerProfileId}
      LIMIT 1
    `;

    if (profile) {
      const updates = [];
      const setClause = [];
      const values = [];

      // Increment total contact count
      setClause.push('total_contact_count = total_contact_count + 1');

      // Category-specific counters
      if (classification.category_primary === 'damaged_missing_faulty') {
        setClause.push('damaged_issue_count = COALESCE(damaged_issue_count, 0) + 1');
      }
      if (classification.category_primary === 'shipping_delivery_order_issue') {
        setClause.push('delivery_issue_count = COALESCE(delivery_issue_count, 0) + 1');
      }
      if (classification.category_primary === 'product_usage_guidance') {
        setClause.push('usage_guidance_count = COALESCE(usage_guidance_count, 0) + 1');
      }
      if (classification.category_primary === 'pre_purchase_question') {
        setClause.push('pre_purchase_count = COALESCE(pre_purchase_count, 0) + 1');
      }
      if (classification.category_primary === 'return_refund_exchange') {
        setClause.push('return_refund_count = COALESCE(return_refund_count, 0) + 1');
      }
      if (classification.category_primary === 'stock_availability') {
        setClause.push('stock_question_count = COALESCE(stock_question_count, 0) + 1');
      }
      if (classification.category_primary === 'praise_testimonial_ugc') {
        setClause.push('praise_ugc_count = COALESCE(praise_ugc_count, 0) + 1');
        setClause.push('lifetime_positive_feedback_count = COALESCE(lifetime_positive_feedback_count, 0) + 1');
      }

      // Increment lifetime issue count (all contacts)
      setClause.push('lifetime_issue_count = COALESCE(lifetime_issue_count, 0) + 1');

      // Update last contact
      setClause.push('last_contact_at = NOW()');
      setClause.push('updated_at = NOW()');

      if (setClause.length > 0) {
        await sql`
          UPDATE customer_profiles
          SET ${setClause.join(', ')}
          WHERE id = ${customerProfileId}
        `;
      }
    }

    // ============================================================================
    // STEP 7: Return all IDs for tracking
    ============================================================================
    return res.status(200).json({
      success: true,
      email_id: inboundEmail.id,
      triage_result_id: triageResult.id,
      ticket_id: ticket.id,
      customer_profile_id: customerProfileId,
      is_new_customer: isNewCustomer,
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
