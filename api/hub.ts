// Hub API endpoints for Sagitine AI CX Agent
// Progressive hydration model for Notification HUD + Resolution Console
import Anthropic from '@anthropic-ai/sdk';
import { neon } from '@neondatabase/serverless';
import { generateResponseStrategy } from '../services/response-strategy';
import {
  generateTOVProofingChecklist,
  applySagitoneTOVCleanup,
  assessBrandCompliance,
} from '../config/sagitine-tov';

export const config = {
  runtime: 'nodejs',
};

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

// Helper SQL condition for HUD-visible tickets
const HUD_VISIBLE_CONDITION = sql`
  (
    tickets.status NOT IN ('archived', 'rejected')
    AND tickets.send_status != 'sent'
  )
`;

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

  
  
  // POST /api/hub/proof - Draft safety check (legacy endpoint, redirects to ticket proof)
  if (req.method === 'POST' && pathname === '/api/hub/proof') {
    return proofTicketDraft(req, res);
  }

  // POST /api/hub/ticket/:id/proof - Real proof endpoint
  if (req.method === 'POST' && pathname.match(/^\/api\/hub\/ticket\/[^/]+\/proof$/)) {
    return proofTicketDraft(req, res);
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
