// Self-contained email classification for Make.com
import { neon } from '@neondatabase/serverless';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  const { subject, body_plain, from_name } = payload;
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
      reply_body: `<p>Hi ${customerName},</p><p>Thank you for letting me know about this.</p><p>Could you please share a photo of the damage and your order number? We'll get a replacement sorted out for you right away.</p><p>Warm regards,<br>Heidi x</p>`,
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
      reply_body: `<p>Hi ${customerName},</p><p>Thank you for reaching out about your order.</p><p>I'm checking on the status of your shipment right now and will get back to you shortly with an update.</p><p>Warm regards,<br>Heidi x</p>`,
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
      reply_body: `<p>Hi ${customerName},</p><p>Thank you for reaching out about a return.</p><p>Could you please provide your order number and let us know what you'd like to return? We'll review your request and get back to you within 1-2 business days.</p><p>Warm regards,<br>Heidi x</p>`,
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
      reply_body: `<p>Hi ${customerName},</p><p>Great question! Here's how to use our product:</p><p>[Insert usage instructions here]</p><p>Hope this helps! Let me know if you have any other questions.</p><p>Warm regards,<br>Heidi x</p>`,
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
      reply_body: `<p>Hi ${customerName},</p><p>Thanks for your interest! We'd be happy to help answer any questions you have.</p><p>What would you like to know about our products?</p><p>Warm regards,<br>Heidi x</p>`,
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
      reply_body: `<p>Hi ${customerName},</p><p>Thanks for checking on stock availability.</p><p>Let me check our current inventory and get back to you shortly with an update.</p><p>Warm regards,<br>Heidi x</p>`,
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
      reply_body: `<p>Hi ${customerName},</p><p>Thanks for reaching out to us.</p><p>This type of inquiry is forwarded to our partnerships team. We'll be in touch shortly.</p><p>Warm regards,<br>Heidi x</p>`,
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
      reply_body: `<p>Hi ${customerName},</p><p>I can certainly help you with modifying your order.</p><p>Could you please provide your order number and let me know what changes you'd like to make?</p><p>Warm regards,<br>Heidi x</p>`,
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
    reply_body: `<p>Hi ${customerName},</p><p>Thank you for your message!</p><p>We'll review your inquiry and get back to you within 1-2 business days.</p><p>Warm regards,<br>Heidi x</p>`,
  };
}

// ============================================================================
// TOV CLEANUP (inline — keeps this file self-contained for Vercel)
// ============================================================================

function applyTOVCleanup(text: string): string {
  let t = text;
  t = t.replace(/I'm sorry to hear/gi, 'Thank you for letting me know');
  t = t.replace(/We apologise for/gi, 'Thank you for bringing this to our attention');
  t = t.replace(/I apologize/gi, 'Thank you');
  t = t.replace(/We apologize/gi, 'We appreciate');
  t = t.replace(/So sorry about/gi, 'I appreciate you sharing');
  t = t.replace(/sorry for any inconvenience/gi, 'thank you for your patience');
  t = t.replace(/Unfortunately[,;\s]+/gi, '');
  t = t.replace(/\bdrawers?\b/gi, 'Box');
  t = t.replace(/\bunit\b/gi, 'Box');
  // Always enforce the exact Sagitine sign-off — strip any variant the LLM may produce
  // This catches "Warm regards, Sagitine Team", "Best regards, X", "Kind regards" etc.
  t = t.replace(/\n+\s*(warm\s+regards|kind\s+regards|best\s+regards|regards|sincerely)[^\n]*(\n[^\n]+)?$/gi, '');
  t = t.trimEnd() + '\n\nWarm regards,\nHeidi x';
  return t;
}

// ============================================================================
// PLAIN TEXT → HTML CONVERSION
// ============================================================================

function plainTextToHTML(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .filter(p => p !== '<p></p>')
    .join('');
}

// ============================================================================
// PERSONALISED REPLY GENERATION (Claude Haiku)
// Self-contained — no imports from api/internal
// Returns null on any failure so the fallback template is used instead
// ============================================================================

async function generatePersonalisedReply(
  category: string,
  customerName: string,
  subject: string,
  bodyPlain: string,
  bodyHtml: string | null,
  sql: any
): Promise<string | null> {
  try {
    // Fetch gold response template for this category from DB
    const templates = await sql`
      SELECT body_template, tone_notes
      FROM gold_responses
      WHERE category = ${category}
        AND is_active = true
      ORDER BY use_count DESC
      LIMIT 1
    `;

    const templateBody: string | null = templates.length > 0 ? templates[0].body_template : null;

    // Fetch recent learning signals — past operator corrections for this category
    const recentSignals = await sql`
      SELECT original_draft, final_draft, operator_feedback_text
      FROM learning_signals
      WHERE original_category = ${category}
      AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 3
    `;

    const learningContext = recentSignals.length > 0
      ? `\nPAST OPERATOR CORRECTIONS FOR THIS CATEGORY (learn from these patterns):\n${recentSignals.map((s: any) => `- ${s.operator_feedback_text ? `Feedback: "${s.operator_feedback_text}"` : `AI draft was revised significantly by operator`}`).join('\n')}\n`
      : '';

    const prompt = `Generate a customer service email response for Sagitine, a premium Australian storage brand.

CUSTOMER:
Name: ${customerName}
Subject: ${subject}
Message: ${bodyPlain.substring(0, 800)}

${templateBody ? `REFERENCE TEMPLATE (adapt this — do not copy exactly):
${templateBody}

` : ''}${learningContext}SAGITINE TONE OF VOICE:
- Calm, warm, polished, quietly premium
- Never apologise — use "Thank you for letting me know" or "Thank you for reaching out"
- Never use "Unfortunately", "I'm sorry", "We apologise"
- Always use "Box" or "Boxes" — never "drawer" or "unit"
- Short paragraphs, direct next step, ownership language
- Sign off exactly as: Warm regards,\nHeidi x

REQUIREMENTS:
1. Address ${customerName} by name in the opening
2. Acknowledge their specific concern naturally — reference what they actually said
3. Provide a clear, helpful next step
4. Sign off as: Warm regards,\nHeidi x
5. Keep it concise — 3 to 4 short paragraphs maximum
6. Do NOT invent refund promises or policies not already in the template

Return the email body only. No subject line. No JSON. No preamble.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    // Apply TOV cleanup then convert to HTML
    const cleaned = applyTOVCleanup(content.text.trim());
    let html = plainTextToHTML(cleaned);

    // Append original email as quoted thread
    if (bodyHtml) {
      html += `<hr><blockquote>${bodyHtml}</blockquote>`;
    }

    return html;
  } catch (error: any) {
    console.error('Personalised reply generation failed, using fallback template:', error?.message || error);
    return null;
  }
}

// ============================================================================
// HANDLER
// ============================================================================

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const rawBody = req.body;

    const sql = neon(process.env.DATABASE_URL!);

    // Basic validation
    if (!rawBody || !rawBody.from_email || !rawBody.subject || !rawBody.body_plain || !rawBody.timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from_email, subject, body_plain, timestamp',
        timestamp: new Date().toISOString(),
      });
    }

    const result = classifyEmail(rawBody);

    // 1. IDEMPOTENCY / DEDUPLICATION
    const messageId = rawBody.message_id || rawBody.sourceMessageId || null;
    if (messageId) {
      const existingEmailQuery = await sql`SELECT id FROM inbound_emails WHERE source_message_id = ${messageId} LIMIT 1`;

      if (existingEmailQuery.length > 0) {
        const existingEmail = existingEmailQuery[0];
        // Return existing ticket data without inserting again
        const existingTicketQuery = await sql`SELECT id FROM tickets WHERE email_id = ${existingEmail.id} LIMIT 1`;
        const existingProfileQuery = await sql`SELECT id FROM customer_profiles WHERE email = ${rawBody.from_email.toLowerCase()} LIMIT 1`;

        return res.status(200).json({
          success: true,
          data: {
            ...result,
            ticket_id: existingTicketQuery.length > 0 ? existingTicketQuery[0].id : null,
            customer_profile_id: existingProfileQuery.length > 0 ? existingProfileQuery[0].id : null,
          },
          message: "Duplicate message_id ignored - returning existing",
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. PROFILE MAPPING (UPSERT)
    const emailStr = rawBody.from_email.toLowerCase();
    const profileName = rawBody.from_name || null;

    let profileId;
    const existingProfile = await sql`SELECT id, total_contact_count, name FROM customer_profiles WHERE email = ${emailStr} LIMIT 1`;

    if (existingProfile.length === 0) {
      const insertedProfile = await sql`
        INSERT INTO customer_profiles (email, name, total_contact_count, last_contact_at, last_contact_channel)
        VALUES (${emailStr}, ${profileName}, 1, NOW(), 'email')
        RETURNING id
      `;
      profileId = insertedProfile[0].id;
    } else {
      profileId = existingProfile[0].id;
      const count = (parseInt(existingProfile[0].total_contact_count) || 0) + 1;
      const finalName = existingProfile[0].name || profileName || null;
      await sql`
        UPDATE customer_profiles
        SET total_contact_count = ${count},
            last_contact_at = NOW(),
            last_contact_channel = 'email',
            name = ${finalName}
        WHERE id = ${profileId}
      `;
    }

    // 2b. PERSONALISED REPLY GENERATION
    // Skipped for spam. Falls back silently to the keyword template on any failure.
    if (result.category_primary !== 'spam_solicitation') {
      const customerName = rawBody.from_name || 'there';
      const personalisedReply = await generatePersonalisedReply(
        result.category_primary,
        customerName,
        rawBody.subject,
        rawBody.body_plain,
        rawBody.body_html || null,
        sql
      );
      if (personalisedReply !== null) {
        result.reply_body = personalisedReply;
      }
    }

    // Ensure reply_subject has Re: prefix without doubling
    if (result.reply_subject && !/^re:\s/i.test(rawBody.subject)) {
      result.reply_subject = `Re: ${rawBody.subject}`;
    } else if (result.reply_subject) {
      result.reply_subject = rawBody.subject;
    }

    // 3. CORE INSERT PIPELINE
    const insertedEmail = await sql`
      INSERT INTO inbound_emails (
        from_email, from_name, subject, body_plain, body_html, source_message_id,
        source_thread_id, received_at, source_system
      ) VALUES (
        ${emailStr}, ${profileName}, ${rawBody.subject}, ${rawBody.body_plain},
        ${rawBody.body_html || null}, ${messageId}, ${rawBody.thread_id || null},
        ${new Date(rawBody.timestamp || new Date()).toISOString()}, 'outlook'
      ) RETURNING id
    `;
    const emailId = insertedEmail[0].id;

    const insertedTriage = await sql`
      INSERT INTO triage_results (
        email_id, category_primary, confidence, urgency, risk_level, customer_intent_summary,
        recommended_next_action, safe_to_auto_draft, safe_to_auto_send, reply_subject, reply_body
      ) VALUES (
        ${emailId}, ${result.category_primary}, ${result.confidence.toString()}, ${result.urgency},
        ${result.risk_level}, ${result.customer_intent_summary}, ${result.recommended_next_action},
        ${result.safe_to_auto_draft}, ${result.safe_to_auto_send}, ${result.reply_subject}, ${result.reply_body}
      ) RETURNING id
    `;
    const triageId = insertedTriage[0].id;

    const insertedTicket = await sql`
      INSERT INTO tickets (email_id, triage_result_id, status)
      VALUES (${emailId}, ${triageId}, 'classified')
      RETURNING id
    `;
    const ticketId = insertedTicket[0].id;

    await sql`
      INSERT INTO customer_contact_facts (
        customer_profile_id, ticket_id, email_id, channel, direction, contact_at
      ) VALUES (
        ${profileId}, ${ticketId}, ${emailId}, 'email', 'inbound', ${new Date(rawBody.timestamp || new Date()).toISOString()}
      )
    `;

    // 4. RETURN EXPECTED PAYLOAD
    return res.status(200).json({
      success: true,
      data: {
        ...result,
        ticket_id: ticketId,
        customer_profile_id: profileId
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
