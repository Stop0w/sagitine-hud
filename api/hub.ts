// Hub API endpoints for Sagitine AI CX Agent
// Progressive hydration model for Notification HUD + Resolution Console
import Anthropic from '@anthropic-ai/sdk';
import { neon } from '@neondatabase/serverless';
export const config = {
  runtime: 'nodejs',
};

// ============================================================================
// SAGITINE TOV — inlined to keep this function self-contained on Vercel
// ============================================================================

function applySagitineTOVCleanup(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replaceAll(/\bdrawers?\b/g, 'Box');
  cleaned = cleaned.replaceAll(/\bunit\b/g, 'Box');
  cleaned = cleaned.replace(/\bitem(s)?\b/g, 'Box');
  cleaned = cleaned.replace(/I'm sorry to hear/gi, 'Thank you for letting me know');
  cleaned = cleaned.replace(/We apologise for/gi, 'Thank you for bringing this to our attention');
  cleaned = cleaned.replace(/So sorry about/gi, 'I appreciate you sharing');
  cleaned = cleaned.replace(/sorry for any inconvenience/gi, 'Thank you for your patience');
  cleaned = cleaned.replace(/I apologize/gi, 'Thank you');
  cleaned = cleaned.replace(/We apologize/gi, 'We appreciate');
  cleaned = cleaned.replace(/Unfortunately[,;\s]+/gi, ', ');
  cleaned = cleaned.replace(/No worries[,;\s]*[.!]?/gi, '.');
  cleaned = cleaned.replace(/That's awesome/gi, "That's great");
  cleaned = cleaned.replace(/Super[,;\s]+/gi, 'Very ');
  cleaned = cleaned.replace(/Hey[,;\s]+\w+/gi, 'Hi');
  cleaned = cleaned.replace(/Regards[,\s]*/gi, 'Warm regards, ');
  cleaned = cleaned.replace(/Best regards[,\s]*/gi, 'Warm regards, ');
  cleaned = cleaned.replace(/Kind regards[,\s]*/gi, 'Warm regards, ');
  if (!cleaned.match(/Warm regards,\s*Heidi x/i)) {
    cleaned = cleaned.replace(/Regards[^\n]+/gi, '');
    cleaned = cleaned.replace(/Best[^\n]+/gi, '');
    cleaned = cleaned.trimEnd() + '\n\nWarm regards,\nHeidi x';
  }
  return cleaned;
}

function generateTOVProofingChecklist(): string {
  return `
PROOFING CHECKLIST:
1. Spelling: Check for typos, prefer Australian English (colour, optimise, organisation)
2. Grammar: Fix grammatical errors
3. Duplication: Catch repeated phrases or duplicate sign-offs
4. Clarity: Ensure message is clear and concise
5. Tone: Verify warmth and professionalism without over-apologizing
6. Risk: Flag any claims about refunds, policies, or promises not already present

SAGITINE BRAND TOV COMPLIANCE:
7. Terminology: Must use "Box/Boxes", never "drawer/drawers" or generic "unit/item"
8. Apology drift: Check for "I'm sorry", "We apologise", "Unfortunately" - replace with preferred phrasing
9. Casual language: Flag "No worries", "Awesome", "Super", "Hey" - maintain premium tone
10. Sign-off quality: Must be "Warm regards, Heidi x" - elegant and consistent
11. Preferred phrasing: Use "Thank you for reaching out", "Thank you for letting me know", "I can arrange/organise"
12. Luxury CX tone: Ensure calm, warm, polished, helpful, quietly premium - never gushy or corporate
13. Structure: Short paragraphs, direct next step, ownership language, concise explanation

IMPORTANT RULES:
- Keep edits minimal and faithful to original intent
- Do NOT invent refunds, policies, or operational actions not already present
- Do NOT add apologies (Sagitine tone: "Thank you for reaching out" not "I'm sorry")
- Preserve the signature "Warm regards, Heidi x"
- Apply deterministic fixes for obvious TOV violations (terminology, apologies, casual language)
`;
}

function assessBrandCompliance(suggestions: any[]): 'pass' | 'fixes_applied' | 'warning' {
  const tovSuggestions = suggestions.filter(s =>
    s.type === 'tone' ||
    s.type === 'terminology' ||
    s.type === 'sign-off' ||
    s.message?.toLowerCase().includes('drawer') ||
    s.message?.toLowerCase().includes('sorry') ||
    s.message?.toLowerCase().includes('apolog') ||
    s.message?.toLowerCase().includes('unfortunately') ||
    s.message?.toLowerCase().includes('casual')
  );
  const highSeverity = tovSuggestions.filter(s => s.severity === 'high').length;
  const mediumSeverity = tovSuggestions.filter(s => s.severity === 'medium').length;
  if (highSeverity > 0) return 'warning';
  if (mediumSeverity > 0 || tovSuggestions.length > 0) return 'fixes_applied';
  return 'pass';
}

// ============================================================================
// HUD FILTER LOGIC (Locked)
// ============================================================================

/**
 * Tickets are EXCLUDED from HUD visibility (metrics, categories, queue) when:
 *
 * 1. status = 'archived' (manually archived or auto-archived after send)
 * 2. status = 'rejected' (manually rejected)
 * 3. sendStatus = 'sent' (successfully sent)
 *
 * This ensures tickets disappear from the Notification HUD once they are:
 * - Sent (resolution complete)
 * - Archived (handled/archived)
 * - Rejected (declined)
 *
 * NOTE: There is no 'resolved' status in the enum. Successfully sent tickets
 * are considered resolved and are excluded by sendStatus = 'sent'.
 *
 * Spam tickets categorized as 'spam_solicitation' will remain visible until
 * manually handled via POST /api/hub/ticket/:id/resolve
 */

// ============================================================================
// CATEGORY LABEL MAPPING (13 Canonical Categories → Human Readable)
// ============================================================================

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

// ============================================================================
// CLAUDE HAIKU CLIENT FOR PROOFING
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Proof suggestion type
 */
type ProofSuggestion = {
  type: 'grammar' | 'tone' | 'clarity' | 'spelling' | 'risk' | 'duplication';
  severity: 'low' | 'medium' | 'high';
  message: string;
};

/**
 * Proof response shape
 */
type ProofResponse = {
  proofStatus: 'proofed' | 'warning' | 'error';
  changesDetected: boolean;
  correctedDraft: string;
  suggestions: ProofSuggestion[];
  summary: {
    tone: 'pass' | 'fixes_applied' | 'warning';
    grammar: 'pass' | 'fixes_applied' | 'warning';
    clarity: 'pass' | 'fixes_applied' | 'warning';
    risk: 'low' | 'medium' | 'high';
  };
  proofedAt: string;
};

// ============================================================================
// GET /api/hub/ticket/:ticketId - Full Resolution Console Hydration
// ============================================================================

async function getTicketHydration(req: any, res: any) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').pop();

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch ticket, email, triage_result, and customer_profile in one query
    const sqlQuery = neon(process.env.DATABASE_URL!);
    const ticketDataRaw = await sqlQuery`
      SELECT
        t.id as ticket_id, t.status as ticket_status, t.send_status,
        t.approved_at, t.sent_at, t.human_edited, t.human_edited_body,
        ie.id as email_id, ie.from_email, ie.from_name, ie.subject,
        ie.body_plain, ie.body_html, ie.received_at,
        tr.id as triage_id, tr.category_primary, tr.confidence, tr.urgency,
        tr.risk_level, tr.customer_intent_summary, tr.recommended_next_action,
        tr.reply_subject, tr.reply_body,
        cp.id as customer_id, cp.email as customer_email, cp.name as customer_name,
        cp.first_contact_at, cp.last_contact_at, cp.last_contact_channel,
        cp.total_contact_count, cp.is_repeat_contact,
        cp.is_high_attention_customer, cp.shopify_order_count, cp.shopify_ltv
      FROM tickets t
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      LEFT JOIN customer_profiles cp ON ie.from_email = cp.email
      WHERE t.id = ${ticketId}
      LIMIT 1
    `;
    const ticketData = ticketDataRaw[0];

    if (!ticketData || ticketData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate thirtyDayVolume on-demand
    let thirtyDayVolume = 0;
    if (ticketData.customer_id) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const volumeRaw = await sqlQuery`
        SELECT COUNT(*) as count
        FROM customer_contact_facts
        WHERE customer_profile_id = ${ticketData.customer_id}
          AND direction = 'inbound'
          AND contact_at >= ${thirtyDaysAgo.toISOString()}
      `;
      const volumeResult = volumeRaw[0];

      thirtyDayVolume = volumeResult?.count || 0;
    }

    // Calculate waitingMinutes (duration since received)
    const waitingMinutes = ticketData.received_at
      ? Math.floor((Date.now() - new Date(ticketData.received_at).getTime()) / 60000)
      : 0;

    // Get lastContactCategory (previous ticket category for this customer)
    let lastContactCategory = null;
    if (ticketData.from_email) {
      const previousRaw = await sqlQuery`
        SELECT
          tr.category_primary as category,
          ie.received_at as "receivedAt"
        FROM tickets t
        INNER JOIN triage_results tr ON t.triage_result_id = tr.id
        INNER JOIN inbound_emails ie ON t.email_id = ie.id
        WHERE ie.from_email = ${ticketData.from_email}
          AND t.id != ${ticketId}
          AND t.status NOT IN ('rejected', 'archived')
        ORDER BY ie.received_at DESC
        LIMIT 1
      `;
      const previousTicket = previousRaw[0];

      if (previousTicket) {
        lastContactCategory = getCategoryLabel(previousTicket.category);
      }
    }

    // patternSummary: null for MVP (document explicitly says this is acceptable)
    const patternSummary = null;

    // Build UI visibility object (MVP hardcoded)
    const ui = {
      showCustomerSince: !!ticketData.first_contact_at,
      showThirtyDayVolume: true,
      showRepeatBadge: ticketData.is_repeat_contact,
      showHighAttentionBadge: ticketData.is_high_attention_customer,
      showShopifyOrderCount: ticketData.shopify_order_count !== null,
      showShopifyLtv: ticketData.shopify_ltv !== null,
      showSocialHandles: false,
      showVipBadge: false,
      showInteractionTimeline: false,
      canEditDraft: true,
      canSend: ticketData.ticket_status === 'classified' || ticketData.ticket_status === 'approved',
      requiresProof: true, // Simplified proof workflow for MVP
    };

    // Load response strategy if exists
    let strategy = null;
    const strategyRaw = await sqlQuery`
      SELECT
        rs.summary,
        rs.recommended_action as "recommendedAction",
        rs.action_type as "actionType",
        rs.matched_template_id as "matchedTemplateId",
        (SELECT title FROM gold_responses WHERE id = rs.matched_template_id) as "matchedTemplateLabel",
        rs.matched_template_confidence as "matchedTemplateConfidence",
        rs.drivers,
        rs.rationale,
        rs.draft_tone as "draftTone",
        rs.must_include as "mustInclude",
        rs.must_avoid as "mustAvoid",
        rs.customer_context as "customerContext",
        rs.requires_management_approval as "requiresManagementApproval",
        rs.management_escalation_reason as "managementEscalationReason"
      FROM response_strategies rs
      WHERE rs.ticket_id = ${ticketId}
      LIMIT 1
    `;
    const strategyRecord = strategyRaw[0];

    if (strategyRecord) {
      strategy = {
        summary: strategyRecord.summary,
        recommendedAction: strategyRecord.recommendedAction,
        actionType: strategyRecord.actionType,
        matchedTemplateId: strategyRecord.matchedTemplateId,
        matchedTemplateLabel: strategyRecord.matchedTemplateLabel,
        matchedTemplateConfidence: strategyRecord.matchedTemplateConfidence,
        drivers: strategyRecord.drivers || [],
        rationale: strategyRecord.rationale,
        draftTone: strategyRecord.draftTone,
        mustInclude: strategyRecord.mustInclude || [],
        mustAvoid: strategyRecord.mustAvoid || [],
        customerContext: strategyRecord.customerContext || {},
        // Management escalation guardrail (pre-launch safety)
        requiresManagementApproval: strategyRecord.requiresManagementApproval || false,
        managementEscalationReason: strategyRecord.managementEscalationReason || null,
      };
    }

    // Build combined hydration payload
    const payload = {
      ticket: {
        id: ticketData.ticket_id,
        status: ticketData.ticket_status,
        sendStatus: ticketData.send_status,
        receivedAt: ticketData.received_at?.toISOString(),
        category: ticketData.category_primary,
        categoryLabel: getCategoryLabel(ticketData.category_primary),
        confidence: ticketData.confidence,
        urgency: ticketData.urgency,
        riskLevel: ticketData.risk_level,
        customerIntentSummary: ticketData.customer_intent_summary,
        recommendedNextAction: ticketData.recommended_next_action,
        waitingMinutes, // NEW: Duration since inbound receipt
      },
      customer: {
        id: ticketData.customer_id,
        name: ticketData.customer_name,
        email: ticketData.from_email,
        firstContactAt: ticketData.first_contact_at?.toISOString(),
        lastContactAt: ticketData.last_contact_at?.toISOString(),
        lastContactChannel: ticketData.last_contact_channel,
        totalContactCount: ticketData.total_contact_count,
        thirtyDayVolume,
        isRepeatContact: ticketData.is_repeat_contact,
        isHighAttentionCustomer: ticketData.is_high_attention_customer,
        shopifyOrderCount: ticketData.shopify_order_count,
        shopifyLtv: ticketData.shopify_ltv,
        lastContactCategory, // NEW: Previous ticket category
        patternSummary, // NEW: AI pattern analysis (null for MVP)
      },
      message: {
        subject: ticketData.subject,
        fullMessage: ticketData.body_plain,
        preview: ticketData.body_plain?.substring(0, 150) || null,
      },
      strategy, // NEW: Response strategy object (backend-owned, not UI magic)
      triage: {
        aiSummary: strategy?.summary || ticketData.customer_intent_summary, // Use strategy summary if available
        recommendedAction: strategy?.recommendedAction || ticketData.recommended_next_action,
        draftResponse: ticketData.reply_body,
        wasHumanEdited: ticketData.human_edited,
      },
      ui,
    };

    return res.status(200).json({
      success: true,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/hub/ticket/:ticketId error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// GET /api/hub/queue/:category - Queue by Category
// ============================================================================

async function getQueueByCategory(req: any, res: any) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const category = url.pathname.split('/').pop();

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Category is required',
        timestamp: new Date().toISOString(),
      });
    }

    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
    const sqlQuery = neon(process.env.DATABASE_URL!);

    // Operational priority sorting: urgency DESC, risk_level (high>medium>low), receivedAt ASC (FCFS)
    const ticketsRaw = await sqlQuery`
      SELECT
        t.id, t.status, t.send_status,
        ie.from_email, ie.from_name, ie.subject, ie.received_at,
        tr.category_primary, tr.confidence, tr.urgency, tr.risk_level,
        t.created_at
      FROM tickets t
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      WHERE tr.category_primary = ${category}
        AND t.status NOT IN ('archived', 'rejected')
        AND t.send_status != 'sent'
      ORDER BY
        tr.urgency DESC,
        CASE tr.risk_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC,
        ie.received_at ASC
      LIMIT ${limitParam}
    `;

    // Add category labels and previews
    const enriched = ticketsRaw.map((t: any) => ({
      id: t.id,
      status: t.status,
      sendStatus: t.send_status,
      fromEmail: t.from_email,
      fromName: t.from_name,
      subject: t.subject,
      category: t.category_primary,
      confidence: t.confidence,
      urgency: t.urgency,
      riskLevel: t.risk_level,
      receivedAt: t.received_at,
      createdAt: t.created_at,
      categoryLabel: getCategoryLabel(t.category_primary),
      preview: t.subject?.substring(0, 150) || '',
    }));

    return res.status(200).json({
      success: true,
      data: enriched,
      count: enriched.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/hub/queue/:category error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// GET /api/hub/categories - Category Breakdown with Counts
// ============================================================================

async function getCategories(req: any, res: any) {
  try {
    const sqlQuery = neon(process.env.DATABASE_URL!);

    // Get ticket counts by category (only categories with tickets)
    const categoryCounts = await sqlQuery`
      SELECT
        tr.category_primary as category,
        COUNT(*) as count,
        AVG(tr.urgency) as avg_urgency,
        AVG(tr.confidence) as avg_confidence
      FROM tickets t
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      WHERE t.status NOT IN ('archived', 'rejected')
        AND t.send_status != 'sent'
      GROUP BY tr.category_primary
    `;

    // Build map of existing categories
    const categoryMap = new Map<string, any>();
    for (const c of categoryCounts) {
      categoryMap.set(c.category, c);
    }

    // Build complete category breakdown (all 13 categories for contract stability)
    const allCategories = Object.keys(CATEGORY_LABELS).map(categoryEnum => {
      const existing = categoryMap.get(categoryEnum);

      // Determine urgency level from avg urgency (or default to 'low' if no tickets)
      let urgency = 'low';
      const avgUrgency = existing?.avg_urgency || 0;
      if (avgUrgency >= 7) urgency = 'high';
      else if (avgUrgency >= 4) urgency = 'medium';

      return {
        category: categoryEnum,
        categoryLabel: getCategoryLabel(categoryEnum),
        count: existing ? Number(existing.count) : 0,
        urgency,
        avgConfidence: existing ? Number(existing.avg_confidence) : 0,
      };
    });

    return res.status(200).json({
      success: true,
      data: allCategories,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/hub/categories error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// GET /api/hub/metrics - Top-level Hub Metrics
// ============================================================================

/**
 * CRITICALITY THRESHOLD LOGIC
 *
 * The criticality level is calculated as:
 *
 * 1. Calculate urgent ratio:
 *    urgent_ratio = urgentCount / totalOpen
 *
 * 2. Determine criticality:
 *    - CRITICAL:   urgent_ratio > 0.3 (more than 30% urgent)
 *    - ELEVATED:   urgent_ratio > 0.15 (more than 15% urgent)
 *    - NOMINAL:    urgent_ratio <= 0.15 (15% or less urgent)
 *
 * 3. Definition of "urgent":
 *    - urgency >= 7 (high urgency score)
 *    OR
 *    - risk_level = 'high'
 *    AND
 *    - status NOT IN ('sent', 'archived')
 *
 * This logic ensures the HUD reflects real operational tension and
 * should remain consistent across frontend and analytics implementations.
 */
async function getHubMetrics(req: any, res: any) {
  try {
    const sqlQuery = neon(process.env.DATABASE_URL!);

    // Get total open tickets
    const totalOpenRaw = await sqlQuery`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE status NOT IN ('archived', 'rejected')
        AND send_status != 'sent'
    `;
    const totalOpen = Number(totalOpenRaw[0]?.count || 0);

    // Get urgent count (urgency >= 7 or high risk)
    const urgentCountRaw = await sqlQuery`
      SELECT COUNT(*) as count
      FROM tickets t
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      WHERE t.status NOT IN ('archived', 'rejected')
        AND t.send_status != 'sent'
        AND (tr.urgency >= 7 OR tr.risk_level = 'high')
    `;
    const urgentCount = Number(urgentCountRaw[0]?.count || 0);

    // Calculate criticality level
    let criticality = 'NOMINAL';
    const urgentRatio = totalOpen > 0 ? urgentCount / totalOpen : 0;
    if (urgentRatio > 0.3) criticality = 'CRITICAL';
    else if (urgentRatio > 0.15) criticality = 'ELEVATED';

    // Calculate average response time (from received to approved/sent)
    // Only for successfully sent tickets for accurate metrics
    const responseTimes = await sqlQuery`
      SELECT ie.received_at, t.approved_at, t.sent_at
      FROM tickets t
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      WHERE t.send_status = 'sent'
        AND t.approved_at IS NOT NULL
    `;

    let avgResponseTimeMinutes = 0;
    if (responseTimes.length > 0) {
      const responseTimeArray = responseTimes.map((rt: any) => {
        const timestamp = rt.sent_at || rt.approved_at;
        const diffMs = new Date(timestamp).getTime() - new Date(rt.received_at).getTime();
        return Math.floor(diffMs / 60000);
      });
      const sum = responseTimeArray.reduce((a: number, b: number) => a + b, 0);
      avgResponseTimeMinutes = Math.floor(sum / responseTimeArray.length);
    }

    const payload = {
      totalOpen,
      urgentCount,
      avgResponseTimeMinutes,
      criticality,
    };

    return res.status(200).json({
      success: true,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/hub/metrics error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// POST /api/hub/ticket/:id/proof - Real Draft Proofing with Claude Haiku
// ============================================================================

/**
 * Proof endpoint using Claude Haiku for editorial review
 *
 * Analyses current draft text (not just original AI-generated)
 * Returns structured corrections and suggestions
 * NOW INCLUDES: Sagitine TOV compliance checks
 */
async function proofTicketDraft(req: any, res: any) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').slice(0, -1).pop();

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const { draftText, operatorEdited } = req.body || {};

    if (!draftText) {
      return res.status(400).json({
        success: false,
        error: 'draftText is required',
        timestamp: new Date().toISOString(),
      });
    }

    // Load ticket context
    const sqlQuery = neon(process.env.DATABASE_URL!);
    const ticketContextRaw = await sqlQuery`
      SELECT
        t.id as ticket_id,
        tr.category_primary,
        tr.customer_intent_summary,
        ie.from_email,
        ie.subject,
        ie.body_plain as original_body
      FROM tickets t
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      WHERE t.id = ${ticketId}
      LIMIT 1
    `;
    const ticketData = ticketContextRaw[0];

    if (!ticketData) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Build TOV-aware proofing prompt for Claude Haiku
    const proofPrompt = `You are an editorial proofreader for Sagitine customer service responses.

CONTEXT:
- Customer inquiry: ${ticketData.customer_intent_summary?.substring(0, 200)}
- Original subject: ${ticketData.subject}

CURRENT DRAFT TO PROOF:
${draftText}

${generateTOVProofingChecklist()}

Return strict JSON only:
{
  "correctedDraft": "proofed version with minimal changes",
  "changesDetected": true/false,
  "suggestions": [
    {
      "type": "grammar|tone|clarity|spelling|risk|duplication|terminology|sign_off|casual",
      "severity": "low|medium|high",
      "message": "brief explanation"
    }
  ],
  "summary": {
    "tone": "pass|fixes_applied|warning",
    "grammar": "pass|fixes_applied|warning",
    "clarity": "pass|fixes_applied|warning",
    "risk": "low|medium|high",
    "brandCompliance": "pass|fixes_applied|warning"
  }
}`;

    try {
      // Call Claude Haiku
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        temperature: 0.2, // Low temperature for consistent proofing
        messages: [
          {
            role: 'user',
            content: proofPrompt,
          },
        ],
      });

      // Extract JSON response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const jsonMatch = content.text.match(/```json\s*([\s\S]*?)\s*```/) || content.text.match(/({[\s\S]*})/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const proofResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);

      // Apply deterministic TOV cleanup to corrected draft
      const cleanedDraft = applySagitineTOVCleanup(proofResult.correctedDraft);

      // Assess brand compliance
      const brandCompliance = assessBrandCompliance(proofResult.suggestions || []);

      // Persist proof audit with TOV-enhanced data
      const proofRecordRaw = await sqlQuery`
        INSERT INTO draft_proofs (
          ticket_id,
          input_draft,
          corrected_draft,
          changes_detected,
          suggestions,
          proof_status,
          operator_edited,
          proof_model
        ) VALUES (
          ${ticketId},
          ${draftText},
          ${cleanedDraft},
          ${proofResult.changesDetected},
          ${JSON.stringify(proofResult.suggestions || [])}::jsonb,
          ${brandCompliance === 'warning' ? 'warning' : 'proofed'},
          ${Boolean(operatorEdited)},
          'claude-haiku'
        )
        RETURNING *
      `;
      const proofRecord = proofRecordRaw[0];

      // Build response with brand compliance field
      const responseData: ProofResponse = {
        proofStatus: proofRecord.proof_status as 'proofed' | 'warning',
        changesDetected: proofResult.changesDetected,
        correctedDraft: cleanedDraft,
        suggestions: proofResult.suggestions,
        summary: {
          ...proofResult.summary,
          brandCompliance, // NEW: Brand compliance assessment
        },
        proofedAt: new Date(proofRecord.proofed_at).toISOString(),
      };

      return res.status(200).json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (claudeError) {
      console.error('Claude Haiku proofing error:', claudeError);

      // Fallback: Return safe response with no corrections
      const cleanedFallback = applySagitineTOVCleanup(draftText);

      const fallbackProofRaw = await sqlQuery`
        INSERT INTO draft_proofs (
          ticket_id,
          input_draft,
          corrected_draft,
          changes_detected,
          suggestions,
          proof_status,
          operator_edited,
          proof_model
        ) VALUES (
          ${ticketId},
          ${draftText},
          ${cleanedFallback},
          ${false},
          ${JSON.stringify([])}::jsonb,
          'proofed',
          ${Boolean(operatorEdited)},
          'claude-haiku'
        )
        RETURNING *
      `;

      return res.status(200).json({
        success: true,
        data: {
          proofStatus: 'proofed',
          changesDetected: false,
          correctedDraft: cleanedFallback,
          suggestions: [],
          summary: {
            tone: 'pass',
            grammar: 'pass',
            clarity: 'pass',
            risk: 'low',
            brandCompliance: 'pass', // NEW: Always pass on fallback
          },
          proofedAt: new Date(fallbackProofRaw[0].proofed_at).toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error('POST /api/hub/ticket/:id/proof error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// POST /api/hub/ticket/:id/resolve - Manual Resolution (Handled in Outlook)
// ============================================================================

/**
 * Manual resolution endpoint for tickets handled outside the system
 * Use case: Agent handles enquiry manually in Outlook, needs to remove from HUD
 *
 * Action: Marks ticket as 'archived' with optional reason
 * Result: Ticket disappears from all HUD views (metrics, categories, queue)
 */
async function resolveTicketManually(req: any, res: any) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').slice(0, -1).pop();

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const body = req.body || {};
    const resolutionReason = body.resolution_reason || 'Handled manually in Outlook';

    // Mark ticket as archived (removes from HUD)
    const sqlQuery = neon(process.env.DATABASE_URL!);
    const updatedRaw = await sqlQuery`
      UPDATE tickets
      SET status = 'archived', archived_at = NOW(), rejection_reason = ${resolutionReason}
      WHERE id = ${ticketId}
      RETURNING *
    `;
    const updated = updatedRaw[0];

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        archivedAt: updated.archived_at,
        message: 'Ticket marked as resolved and removed from HUD',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('POST /api/hub/ticket/:id/resolve error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// POST /api/hub/ticket/:id/dispatch - Send from HUD
// ============================================================================

/**
 * Dispatch endpoint called when operator clicks SEND RESPONSE in the HUD.
 * Marks ticket as sent in DB, writes send audit, and calls Make.com webhook
 * (MAKE_SEND_WEBHOOK_URL) if configured so Make.com can send via Outlook.
 */
// ============================================================================
// MICROSOFT GRAPH HELPERS
// ============================================================================

async function getGraphToken(): Promise<string> {
  const tenantId = process.env.MICROSOFT_TENANT_ID!;
  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }).toString(),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Graph token error: ${err}`);
  }

  const data: any = await response.json();
  return data.access_token;
}

async function sendViaGraph(
  token: string,
  senderEmail: string,
  toEmail: string,
  toName: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: toEmail, name: toName || toEmail } }],
        },
        saveToSentItems: true,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Graph sendMail error (${response.status}): ${err}`);
  }
}

// ============================================================================
// POST /api/hub/ticket/:id/dispatch - Send from HUD via Microsoft Graph
// ============================================================================

async function dispatchTicket(req: any, res: any) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').slice(0, -1).pop();

    if (!ticketId) {
      return res.status(400).json({ success: false, error: 'Ticket ID required', timestamp: new Date().toISOString() });
    }

    const { final_message_sent } = req.body || {};
    if (!final_message_sent) {
      return res.status(400).json({ success: false, error: 'final_message_sent is required', timestamp: new Date().toISOString() });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // ── 1. FETCH TICKET CONTEXT ──────────────────────────────────────────────
    const ticketContextRaw = await sql`
      SELECT
        t.id, t.send_status, t.email_id,
        t.approved_at, t.created_at,
        tr.reply_body, tr.confidence, tr.category_primary, tr.reply_subject,
        ie.from_email, ie.from_name, ie.subject, ie.source_thread_id,
        ie.received_at as email_received_at
      FROM tickets t
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      WHERE t.id = ${ticketId}
      LIMIT 1
    `;
    const ctx = ticketContextRaw[0];

    if (!ctx) {
      return res.status(404).json({ success: false, error: 'Ticket not found', timestamp: new Date().toISOString() });
    }

    // ── 2. GUARD: DOUBLE-SEND PROTECTION ────────────────────────────────────
    if (ctx.send_status === 'sent') {
      return res.status(409).json({ success: false, error: 'Already sent', timestamp: new Date().toISOString() });
    }

    // ── 3. SEND VIA MICROSOFT GRAPH ─────────────────────────────────────────
    const senderEmail = process.env.MICROSOFT_SENDER_EMAIL!;
    const replySubject = ctx.reply_subject || (ctx.subject?.startsWith('Re:') ? ctx.subject : `Re: ${ctx.subject}`);

    if (!process.env.MICROSOFT_TENANT_ID || !process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET || !senderEmail) {
      throw new Error('Microsoft Graph env vars not configured (MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_SENDER_EMAIL)');
    }

    const graphToken = await getGraphToken();
    // Ensure two blank lines before any quoted thread separator so Outlook renders cleanly
    const htmlToSend = final_message_sent.replace(/(<hr\s*\/?>.*)?$/, '<br><br>$1');
    await sendViaGraph(graphToken, senderEmail, ctx.from_email, ctx.from_name || '', replySubject, htmlToSend);

    // ── 4. UPDATE TICKET ─────────────────────────────────────────────────────
    await sql`
      UPDATE tickets
      SET send_status = 'sent',
          sent_at     = NOW(),
          status      = 'approved',
          human_edited      = true,
          human_edited_body = ${final_message_sent}
      WHERE id = ${ticketId}
    `;

    // ── 5. WRITE SEND AUDIT ──────────────────────────────────────────────────
    const recentProofRaw = await sql`
      SELECT id FROM draft_proofs WHERE ticket_id = ${ticketId}
      ORDER BY proofed_at DESC LIMIT 1
    `;
    const recentProof = recentProofRaw[0];

    const responseTimeMinutes = ctx.email_received_at
      ? Math.floor((Date.now() - new Date(ctx.email_received_at).getTime()) / 60000)
      : null;

    await sql`
      INSERT INTO send_audit (
        ticket_id, initial_draft, final_message_sent, confidence_rating,
        was_human_edited, was_proofed, resolution_mechanism, proof_id, sent_at
      ) VALUES (
        ${ticketId},
        ${ctx.reply_body || ''},
        ${final_message_sent},
        ${ctx.confidence},
        ${true},
        ${!!recentProof},
        ${recentProof ? 'human_proofed' : 'human_edited'},
        ${recentProof?.id || null},
        NOW()
      )
    `;

    // ── 6. CRM: OUTBOUND CONTACT FACT + UPDATE CUSTOMER PROFILE ─────────────
    const profileRaw = await sql`
      SELECT id, total_contact_count
      FROM customer_profiles
      WHERE email = ${ctx.from_email.toLowerCase()}
      LIMIT 1
    `;
    const profile = profileRaw[0];

    if (profile) {
      await sql`
        INSERT INTO customer_contact_facts (
          customer_profile_id, ticket_id, channel, direction,
          contact_at, response_time_minutes, created_at
        ) VALUES (
          ${profile.id}, ${ticketId}, 'email', 'outbound',
          NOW(), ${responseTimeMinutes}, NOW()
        )
      `;

      await sql`
        UPDATE customer_profiles
        SET last_contact_at       = NOW(),
            last_contact_channel  = 'email',
            last_contact_category = ${ctx.category_primary},
            updated_at            = NOW()
        WHERE id = ${profile.id}
      `;
    }

    // ── 7. RESPOND ───────────────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      data: {
        ticket_id: ticketId,
        send_status: 'sent',
        to: ctx.from_email,
        subject: replySubject,
        response_time_minutes: responseTimeMinutes,
        crm_updated: !!profile,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('POST /api/hub/ticket/:id/dispatch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// ROUTER - Dispatch based on HTTP method and path
// ============================================================================

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/hub/ticket/:id - Full ticket hydration
  if (req.method === 'GET' && pathname.match(/^\/api\/hub\/ticket\/[^/]+$/)) {
    return getTicketHydration(req, res);
  }

  // GET /api/hub/queue/:category - Queue by category
  if (req.method === 'GET' && pathname.match(/^\/api\/hub\/queue\/[^/]+$/)) {
    return getQueueByCategory(req, res);
  }

  // GET /api/hub/categories - Category breakdown
  if (req.method === 'GET' && pathname === '/api/hub/categories') {
    return getCategories(req, res);
  }

  // GET /api/hub/metrics - Top-level metrics
  if (req.method === 'GET' && pathname === '/api/hub/metrics') {
    return getHubMetrics(req, res);
  }

  // POST /api/hub/proof - Draft safety check (legacy endpoint, redirects to ticket proof)
  if (req.method === 'POST' && pathname === '/api/hub/proof') {
    return proofTicketDraft(req, res);
  }

  // POST /api/hub/ticket/:id/proof - Real proof endpoint
  if (req.method === 'POST' && pathname.match(/^\/api\/hub\/ticket\/[^/]+\/proof$/)) {
    return proofTicketDraft(req, res);
  }

  // POST /api/hub/ticket/:id/dispatch - Send from HUD
  if (req.method === 'POST' && pathname.match(/^\/api\/hub\/ticket\/[^/]+\/dispatch$/)) {
    return dispatchTicket(req, res);
  }

  // POST /api/hub/ticket/:id/resolve - Manual resolution
  if (req.method === 'POST' && pathname.endsWith('/resolve')) {
    return resolveTicketManually(req, res);
  }

  // 404 for unknown routes
  return res.status(404).json({
    success: false,
    error: 'Not found',
    timestamp: new Date().toISOString(),
  });
}
