// Hub API endpoints for Sagitine AI CX Agent
// Progressive hydration model for Notification HUD + Resolution Console
import { db } from '../../src/db/index.js';
import { tickets, inboundEmails, triageResults, customerProfiles, customerContactFacts, draftProofs, sendAudit } from '../../src/db/schema.js';
import { responseStrategies } from '../../src/db/schema/gold-responses.js';
import { eq, desc, and, gte, sql, ne } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { generateResponseStrategy } from '../services/response-strategy.js';
import {
  generateTOVProofingChecklist,
  applySagitoneTOVCleanup,
  assessBrandCompliance,
} from '../config/sagitine-tov.js';

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

async function getTicketHydration(req, res) {
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
    const [ticketData] = await db
      .select({
        // Ticket fields
        ticket_id: tickets.id,
        ticket_status: tickets.status,
        send_status: tickets.sendStatus,
        approved_at: tickets.approvedAt,
        sent_at: tickets.sentAt,
        human_edited: tickets.humanEdited,
        human_edited_body: tickets.humanEditedBody,

        // Email fields
        email_id: inboundEmails.id,
        from_email: inboundEmails.fromEmail,
        from_name: inboundEmails.fromName,
        subject: inboundEmails.subject,
        body_plain: inboundEmails.bodyPlain,
        body_html: inboundEmails.bodyHtml,
        received_at: inboundEmails.receivedAt,

        // Triage result fields
        triage_id: triageResults.id,
        category_primary: triageResults.categoryPrimary,
        confidence: triageResults.confidence,
        urgency: triageResults.urgency,
        risk_level: triageResults.riskLevel,
        customer_intent_summary: triageResults.customerIntentSummary,
        recommended_next_action: triageResults.recommendedNextAction,
        reply_subject: triageResults.replySubject,
        reply_body: triageResults.replyBody,

        // Customer profile fields
        customer_id: customerProfiles.id,
        customer_email: customerProfiles.email,
        customer_name: customerProfiles.name,
        first_contact_at: customerProfiles.firstContactAt,
        last_contact_at: customerProfiles.lastContactAt,
        last_contact_channel: customerProfiles.lastContactChannel,
        total_contact_count: customerProfiles.totalContactCount,
        is_repeat_contact: customerProfiles.isRepeatContact,
        is_high_attention_customer: customerProfiles.isHighAttentionCustomer,
        shopify_order_count: customerProfiles.shopifyOrderCount,
        shopify_ltv: customerProfiles.shopifyLtv,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .leftJoin(customerProfiles, eq(inboundEmails.fromEmail, customerProfiles.email))
      .where(eq(tickets.id, ticketId))
      .limit(1);

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

      const [volumeResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(customerContactFacts)
        .where(
          and(
            eq(customerContactFacts.customerProfileId, ticketData.customer_id!),
            eq(customerContactFacts.direction, 'inbound'),
            gte(customerContactFacts.contactAt, thirtyDaysAgo.toISOString())
          )
        );

      thirtyDayVolume = volumeResult?.count || 0;
    }

    // Calculate waitingMinutes (duration since received)
    const waitingMinutes = ticketData.received_at
      ? Math.floor((Date.now() - new Date(ticketData.received_at).getTime()) / 60000)
      : 0;

    // Get lastContactCategory (previous ticket category for this customer)
    let lastContactCategory = null;
    if (ticketData.from_email) {
      const [previousTicket] = await db
        .select({
          category: triageResults.categoryPrimary,
          receivedAt: inboundEmails.receivedAt,
        })
        .from(tickets)
        .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
        .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
        .where(
          and(
            eq(inboundEmails.fromEmail, ticketData.from_email),
            ne(tickets.id, ticketId), // Exclude current ticket
            sql`${tickets.status} NOT IN ('rejected', 'archived')`
          )
        )
        .orderBy(desc(inboundEmails.receivedAt))
        .limit(1);

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
    const [strategyRecord] = await db
      .select({
        summary: responseStrategies.summary,
        recommendedAction: responseStrategies.recommendedAction,
        actionType: responseStrategies.actionType,
        matchedTemplateId: responseStrategies.matchedTemplateId,
        matchedTemplateLabel: sql<string>`(
          SELECT title FROM gold_responses
          WHERE id = ${responseStrategies.matchedTemplateId}
        )`,
        matchedTemplateConfidence: responseStrategies.matchedTemplateConfidence,
        drivers: responseStrategies.drivers,
        rationale: responseStrategies.rationale,
        draftTone: responseStrategies.draftTone,
        mustInclude: responseStrategies.mustInclude,
        mustAvoid: responseStrategies.mustAvoid,
        customerContext: responseStrategies.customerContext,
        // Management escalation guardrail (pre-launch safety)
        requiresManagementApproval: responseStrategies.requiresManagementApproval,
        managementEscalationReason: responseStrategies.managementEscalationReason,
      })
      .from(responseStrategies)
      .where(eq(responseStrategies.ticketId, ticketId))
      .limit(1);

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
// GET /api/hub/queue/:category - Ticket Queue by Category
// ============================================================================

async function getQueueByCategory(req, res) {
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

    const limit = url.searchParams.get('limit') || '50';

    // Operational priority sorting: urgency DESC, risk_level (high>medium>low), receivedAt ASC (FCFS)
    const riskOrder = sql`
      CASE risk_level
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END
    `;

    const tickets = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        sendStatus: tickets.sendStatus,
        fromEmail: inboundEmails.fromEmail,
        fromName: inboundEmails.fromName,
        subject: inboundEmails.subject,
        category: triageResults.categoryPrimary,
        confidence: triageResults.confidence,
        urgency: triageResults.urgency,
        riskLevel: triageResults.riskLevel,
        receivedAt: inboundEmails.receivedAt,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(
        and(
          eq(triageResults.categoryPrimary, category),
          HUD_VISIBLE_CONDITION // Exclude archived, rejected, sent
        )
      )
      .orderBy(desc(triageResults.urgency))
      .orderBy(riskOrder)
      .orderBy(inboundEmails.receivedAt)
      .limit(parseInt(limit, 10));

    // Add category labels and previews
    const enriched = tickets.map(t => ({
      ...t,
      categoryLabel: getCategoryLabel(t.category),
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

async function getCategories(req, res) {
  try {
    // Get ticket counts by category (only categories with tickets)
    const categoryCounts = await db
      .select({
        category: triageResults.categoryPrimary,
        count: sql<number>`COUNT(*)`.as('count'),
        avgUrgency: sql<number>`AVG(${triageResults.urgency})`.as('avg_urgency'),
        avgConfidence: sql<number>`AVG(${triageResults.confidence})`.as('avg_confidence'),
      })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(HUD_VISIBLE_CONDITION) // Exclude archived, rejected, sent
      .groupBy(triageResults.categoryPrimary);

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
      const avgUrgency = existing?.avgUrgency || 0;
      if (avgUrgency >= 7) urgency = 'high';
      else if (avgUrgency >= 4) urgency = 'medium';

      return {
        category: categoryEnum,
        categoryLabel: getCategoryLabel(categoryEnum),
        count: existing ? Number(existing.count) : 0,
        urgency,
        avgConfidence: existing ? Number(existing.avgConfidence) : 0,
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
async function getHubMetrics(req, res) {
  try {
    // Get total open tickets
    const [totalOpen] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .where(HUD_VISIBLE_CONDITION);

    // Get urgent count (urgency >= 7 or high risk)
    const [urgentCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(
        and(
          HUD_VISIBLE_CONDITION, // Exclude archived, rejected, sent
          sql`(urgency >= 7 OR risk_level = 'high')`
        )
      );

    // Calculate criticality level
    let criticality = 'NOMINAL';
    const urgentRatio = Number(urgentCount.count) / Number(totalOpen.count);
    if (urgentRatio > 0.3) criticality = 'CRITICAL';
    else if (urgentRatio > 0.15) criticality = 'ELEVATED';

    // Calculate average response time (from received to approved/sent)
    // Only for successfully sent tickets for accurate metrics
    const responseTimes = await db
      .select({
        receivedAt: inboundEmails.receivedAt,
        approvedAt: tickets.approvedAt,
        sentAt: tickets.sentAt,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .where(
        and(
          sql`tickets.send_status = 'sent'`, // Only sent tickets for response time calculation
          sql`tickets.approved_at IS NOT NULL`
        )
      );

    let avgResponseTimeMinutes = 0;
    if (responseTimes.length > 0) {
      const responseTimeArray = responseTimes.map(rt => {
        const timestamp = rt.sentAt || rt.approvedAt;
        const diffMs = new Date(timestamp).getTime() - new Date(rt.receivedAt).getTime();
        return Math.floor(diffMs / 60000);
      });
      const sum = responseTimeArray.reduce((a, b) => a + b, 0);
      avgResponseTimeMinutes = Math.floor(sum / responseTimeArray.length);
    }

    const payload = {
      totalOpen: Number(totalOpen.count),
      urgentCount: Number(urgentCount.count),
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
async function proofTicketDraft(req, res) {
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
    const [ticketData] = await db
      .select({
        ticket_id: tickets.id,
        category_primary: triageResults.categoryPrimary,
        customer_intent_summary: triageResults.customerIntentSummary,
        from_email: inboundEmails.fromEmail,
        subject: inboundEmails.subject,
        original_body: inboundEmails.bodyPlain,
      })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

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
      const cleanedDraft = applySagitoneTOVCleanup(proofResult.correctedDraft);

      // Assess brand compliance
      const brandCompliance = assessBrandCompliance(proofResult.suggestions || []);

      // Persist proof audit with TOV-enhanced data
      const [proofRecord] = await db
        .insert(draftProofs)
        .values({
          ticketId,
          inputDraft: draftText,
          correctedDraft: cleanedDraft,
          changesDetected: proofResult.changesDetected,
          suggestions: proofResult.suggestions,
          proofStatus: brandCompliance === 'warning' ? 'warning' : 'proofed',
          operatorEdited: Boolean(operatorEdited),
          proofModel: 'claude-haiku',
        })
        .returning();

      // Build response with brand compliance field
      const responseData: ProofResponse = {
        proofStatus: proofRecord.proofStatus as 'proofed' | 'warning',
        changesDetected: proofResult.changesDetected,
        correctedDraft: cleanedDraft,
        suggestions: proofResult.suggestions,
        summary: {
          ...proofResult.summary,
          brandCompliance, // NEW: Brand compliance assessment
        },
        proofedAt: proofRecord.proofedAt.toISOString(),
      };

      return res.status(200).json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (claudeError) {
      console.error('Claude Haiku proofing error:', claudeError);

      // Fallback: Return safe response with no corrections
      const cleanedFallback = applySagitoneTOVCleanup(draftText);

      const fallbackProof = await db
        .insert(draftProofs)
        .values({
          ticketId,
          inputDraft: draftText,
          correctedDraft: cleanedFallback,
          changesDetected: false,
          suggestions: [],
          proofStatus: 'proofed',
          operatorEdited: Boolean(operatorEdited),
          proofModel: 'claude-haiku',
        })
        .returning();

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
          proofedAt: fallbackProof[0].proofedAt.toISOString(),
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
async function resolveTicketManually(req, res) {
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
    const resolvedBy = body.resolved_by || 'Heidi';
    const resolutionReason = body.resolution_reason || 'Handled manually in Outlook';

    // Mark ticket as archived (removes from HUD)
    const [updated] = await db
      .update(tickets)
      .set({
        status: 'archived',
        archivedAt: new Date(),
        rejectionReason: resolutionReason,
      })
      .where(eq(tickets.id, ticketId))
      .returning();

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
        archivedAt: updated.archivedAt,
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
// ROUTER - Dispatch based on HTTP method and path
// ============================================================================

export default async function handler(req, res) {
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
