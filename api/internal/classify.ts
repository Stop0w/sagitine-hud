// Enhanced mock classification for Make.com workflow testing
// Uses keyword-based logic until real Claude runtime is fixed
import type { InboundEmailPayload, ClassificationAPIResponse } from '../../src/api/types';
import { db } from '../../src/db';
import { inboundEmails, triageResults, tickets } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import {
  findOrCreateProfile,
  recordInboundContactFact,
  updateProfileRollups,
} from '../../src/api/services/customer-profile-service';
import { generateResponseStrategy } from './services/response-strategy';
import { generateDraftFromStrategy } from './services/draft-generation';

function classifyEmail(payload: InboundEmailPayload) {
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

    // ============================================================================
    // STEP 0: Find or create customer profile
    // Capture every touchpoint before classification
    // ============================================================================
    const { id: customerProfileId, isNew: isNewCustomer } = await findOrCreateProfile(
      payload.from_email,
      payload.from_name
    );

    // ============================================================================
    // STEP 1: Store inbound_email FIRST (never lose raw data)
    // IDEMPOTENCY: Use onConflictDoNothing to prevent duplicate processing
    // ============================================================================
    const insertResult = await db.insert(inboundEmails)
      .values({
        sourceMessageId: payload.message_id,
        sourceThreadId: payload.thread_id,
        fromEmail: payload.from_email,
        fromName: payload.from_name,
        subject: payload.subject,
        bodyPlain: payload.body_plain,
        bodyHtml: payload.body_html,
        receivedAt: new Date(payload.timestamp),
      })
      .onConflictDoNothing({
        target: inboundEmails.sourceMessageId,
      })
      .returning();

    // If email already exists (duplicate trigger), return existing record
    if (!insertResult || insertResult.length === 0) {
      // Fetch the existing email to return to caller
      const existing = await db.select()
        .from(inboundEmails)
        .where(eq(inboundEmails.sourceMessageId, payload.message_id))
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(200).json({
          success: true,
          email_id: existing[0].id,
          triage_result_id: null,
          ticket_id: null,
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
    // ============================================================================
    const classification = classifyEmail(payload);

    // ============================================================================
    // STEP 3: Store triage_result linked via email_id
    // ============================================================================
    const [triageResult] = await db.insert(triageResults).values({
      emailId: inboundEmail.id,
      categoryPrimary: classification.category_primary,
      confidence: classification.confidence,
      urgency: classification.urgency,
      riskLevel: classification.risk_level,
      riskFlags: classification.risk_flags,
      customerIntentSummary: classification.customer_intent_summary,
      recommendedNextAction: classification.recommended_next_action,
      safeToAutoDraft: classification.safe_to_auto_draft,
      safeToAutoSend: classification.safe_to_auto_send,
      replySubject: classification.reply_subject,
      replyBody: classification.reply_body,
      retrievedKnowledgeIds: classification.retrieved_knowledge_ids,
      isMock: true,
    } as any).returning();

    // ============================================================================
    // STEP 4: Create ticket in workflow state
    // ============================================================================
    const [ticket] = await db.insert(tickets).values({
      emailId: inboundEmail.id,
      triageResultId: triageResult.id,
      status: 'classified',
      sendStatus: 'not_applicable',
    }).returning();

    // ============================================================================
    // STEP 4.5: Generate Response Strategy (NOW LIVE FOR ALL TICKETS)
    // Replaces mock draft with strategy-driven draft generation
    // ============================================================================
    try {
      // Generate complete response strategy from deterministic logic + Haiku
      const strategy = await generateResponseStrategy(ticket.id);

      // Generate final draft from strategy using Haiku
      const finalDraft = await generateDraftFromStrategy(strategy, {
        ticket: {
          id: ticket.id,
          category: classification.category_primary,
          urgency: classification.urgency,
          riskLevel: classification.risk_level,
          confidence: classification.confidence,
        },
        customer: {
          email: payload.from_email,
          name: payload.from_name,
          isRepeatContact: false,
          isHighAttentionCustomer: false,
          totalContactCount: 0,
          lastContactCategory: null,
          shopifyOrderCount: null,
          shopifyLtv: null,
        },
        email: {
          subject: payload.subject,
          bodyPlain: payload.body_plain,
          receivedAt: new Date(payload.timestamp),
        },
      });

      // Update triage_result with strategy-driven fields
      await db.update(triageResults)
        .set({
          replyBody: finalDraft,
          customerIntentSummary: strategy.summary,
          recommendedNextAction: strategy.recommendedAction,
        })
        .where(eq(triageResults.id, triageResult.id));

      console.log(`✓ Response strategy generated for ticket ${ticket.id}: ${strategy.actionType} (confidence: ${strategy.matchedTemplateConfidence}%)`);
    } catch (strategyError) {
      // Fallback to mock-generated draft if strategy fails
      console.error('Response strategy generation failed (using fallback draft):', strategyError);
    }

    // ============================================================================
    // STEP 5: Record inbound customer contact fact
    // Create contact fact AFTER classification (requires category/urgency/risk)
    // ============================================================================
    await recordInboundContactFact({
      customerProfileId,
      ticketId: ticket.id,
      emailId: inboundEmail.id,
      category: classification.category_primary as any, // Type assertion for CanonicalCategory
      urgency: classification.urgency,
      riskLevel: classification.risk_level as any, // Type assertion for RiskLevel
      customerIntentSummary: classification.customer_intent_summary,
    });

    // ============================================================================
    // STEP 6: Update customer profile rollups
    // Atomically increment counters based on contact category
    // ============================================================================
    await updateProfileRollups(customerProfileId, {
      category: classification.category_primary as any, // Type assertion for CanonicalCategory
      urgency: classification.urgency,
      riskLevel: classification.risk_level as any, // Type assertion for RiskLevel
      hadPositiveFeedback: classification.category_primary === 'praise_testimonial_ugc',
    });

    // ============================================================================
    // STEP 7: Return all IDs for tracking
    // ============================================================================
    return res.status(200).json({
      success: true,
      email_id: inboundEmail.id,
      triage_result_id: triageResult.id,
      ticket_id: ticket.id,
      customer_profile_id: customerProfileId,
      is_new_customer: isNewCustomer,
      data: classification,
      timestamp: new Date().toISOString(),
      _mode: 'mock_enhanced', // Indicates we're in enhanced mock mode
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
