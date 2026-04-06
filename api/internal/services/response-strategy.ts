/**
 * Response Strategy Service
 *
 * Backend-owned response strategy layer.
 *
 * Deterministic → Database-driven → Template-matched → Haiku-controlled
 *
 * Architecture:
 * 1. Load ticket + customer + email context
 * 2. Match category → gold_response template (deterministic SQL)
 * 3. Evaluate customer profile (repeat/LTV/patterns)
 * 4. Assess urgency/risk → determine action type
 * 5. Build strategy object from rules + templates
 * 6. Persist strategy to response_strategies table
 * 7. Return strategy for draft generation
 */

import { neon } from '@neondatabase/serverless';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// TYPES
// ============================================================================

export interface StrategyContext {
  ticket: {
    id: string;
    category: string;
    urgency: number;
    riskLevel: string;
    confidence: number;
  };
  customer: {
    email: string;
    name: string | null;
    isRepeatContact: boolean;
    isHighAttentionCustomer: boolean;
    totalContactCount: number;
    lastContactCategory: string | null;
    shopifyOrderCount: number | null;
    shopifyLtv: number | null;
  };
  email: {
    subject: string;
    bodyPlain: string;
    receivedAt: Date;
  };
}

export interface ResponseStrategy {
  summary: string;
  recommendedAction: string;
  actionType: string;
  matchedTemplateId: string | null;
  matchedTemplateLabel: string | null;
  matchedTemplateConfidence: number;
  drivers: string[];
  rationale: string;
  draftTone: string;
  mustInclude: string[];
  mustAvoid: string[];
  customerContext: Record<string, any>;
  templateBody: string | null; // For draft generation
  // Management escalation guardrail (pre-launch safety)
  requiresManagementApproval: boolean;
  managementEscalationReason: string | null;
}

// ============================================================================
// ACTION TYPE RULE MATRIX (Deterministic)
// ============================================================================

/**
 * Determines appropriate action type based on:
 * - Category
 * - Urgency (1-10)
 * - Risk Level
 * - Customer status
 */
function determineActionType(ctx: StrategyContext): string {
  const { category, urgency, riskLevel } = ctx.ticket;
  const { isRepeatContact, isHighAttentionCustomer } = ctx.customer;

  // High-risk or high-urgency → Escalate or accelerate
  if (riskLevel === 'high' || urgency >= 8) {
    // Damaged/faulty products need replacement at high urgency
    if (category === 'damaged_missing_faulty') {
      return 'arrange_replacement';
    }
    // Returns/refunds need expedited processing (not replacement)
    if (category === 'return_refund_exchange') {
      return 'process_refund';
    }
    // Billing issues at high urgency/risk need escalation
    if (category === 'account_billing_payment') {
      return 'escalate';
    }
  }

  // Repeat customer with high contact volume → Escalate
  if (isRepeatContact) {
    if (urgency >= 8) {
      return 'escalate';
    }
  }

  // Category-based action mapping
  const actionMap: Record<string, string> = {
    damaged_missing_faulty: 'arrange_replacement',
    shipping_delivery_order_issue: 'provide_information',
    product_usage_guidance: 'provide_information',
    pre_purchase_question: 'provide_information',
    return_refund_exchange: 'process_refund',
    stock_availability: 'provide_information',
    partnership_wholesale_press: 'route_to_team',
    brand_feedback_general: 'acknowledge_feedback',
    spam_solicitation: 'decline_request',
    account_billing_payment: 'provide_information',
    order_modification_cancellation: 'request_info',
    praise_testimonial_ugc: 'acknowledge_feedback',
    other_uncategorized: 'request_info',
  };

  return actionMap[category] || 'provide_information';
}

// ============================================================================
// MANAGEMENT ESCALATION TRIGGER DETECTION (Pre-Launch Safety)
// ============================================================================

/**
 * ManagementEscalationDetection - Result of high-risk content analysis
 */
interface ManagementEscalationDetection {
  requiresApproval: boolean;
  reason: string | null;
}

/**
 * Detects high-risk content that requires management approval before response.
 *
 * Uses hybrid approach:
 * 1. Deterministic keyword / rule detection first
 * 2. Risk level and category signals
 * 3. Safe default: flag for review if uncertain
 */
function detectManagementEscalation(
  ctx: StrategyContext
): ManagementEscalationDetection {
  const { category, urgency, riskLevel } = ctx.ticket;
  const { email } = ctx;

  const emailText = `${email.subject} ${email.bodyPlain}`.toLowerCase();

  // High-risk keyword patterns (deterministic detection)
  const CHARGEBACK_PATTERNS = [
    'chargeback',
    'charge back',
    'dispute with my bank',
    'dispute with my credit card',
    'credit card dispute',
    'bank dispute',
    'reverse the charge',
    'reverse charges',
  ];

  const LEGAL_THREAT_PATTERNS = [
    'legal action',
    'taking legal action',
    'sue you',
    'suing you',
    'lawyer',
    'attorney',
    'legal representation',
    'consumer affairs',
    'fair trading',
    'accc',
    'ombudsman',
    'regulatory body',
    'report you to',
    'file a complaint with',
    'legal proceedings',
    'court action',
    'small claims',
    'small claims court',
    'class action',
  ];

  const AGGRESSIVE_PATTERNS = [
    'ridiculous',
    'unacceptable',
    'this is a joke',
    'this is a scam',
    'worst company',
    'never ordering again',
    'terrible service',
    'horrible service',
    'disgrace',
    'shame on you',
    'you should be ashamed',
    'incompetent',
    'useless',
    'waste of time',
    '!!!', // Multiple exclamation marks (aggressive indicator)
  ];

  const HIGH_RISK_REFUND_PATTERNS = [
    'refund now',
    'immediate refund',
    'refund immediately',
    'want my money back now',
    'give me my money back',
    'not accepting',
    'will not accept',
    'demand refund',
    'i demand',
    'insist on refund',
  ];

  // Check each pattern category
  for (const pattern of CHARGEBACK_PATTERNS) {
    if (emailText.includes(pattern)) {
      return {
        requiresApproval: true,
        reason: 'Chargeback language detected',
      };
    }
  }

  for (const pattern of LEGAL_THREAT_PATTERNS) {
    if (emailText.includes(pattern)) {
      return {
        requiresApproval: true,
        reason: 'Legal escalation language detected',
      };
    }
  }

  // Check for multiple aggressive indicators (not just one)
  let aggressiveCount = 0;
  for (const pattern of AGGRESSIVE_PATTERNS) {
    if (emailText.includes(pattern)) {
      aggressiveCount++;
      if (aggressiveCount >= 2) {
        return {
          requiresApproval: true,
          reason: 'Aggressive complaint requires review',
        };
      }
    }
  }

  // Check for high-risk refund disputes with aggressive language
  if (category === 'return_refund_exchange' || category === 'damaged_missing_faulty') {
    for (const pattern of HIGH_RISK_REFUND_PATTERNS) {
      if (emailText.includes(pattern)) {
        return {
          requiresApproval: true,
          reason: 'High-risk refund dispute',
        };
      }
    }
  }

  // Fallback: Check for high risk level + high urgency + certain categories
  // Safe default: flag for review rather than allowing autonomous send
  if (riskLevel === 'high' && urgency >= 9) {
    // High-risk categories that definitely need management review
    const sensitiveCategories = [
      'return_refund_exchange',
      'damaged_missing_faulty',
      'account_billing_payment',
      'brand_feedback_general',
    ];

    if (sensitiveCategories.includes(category)) {
      return {
        requiresApproval: true,
        reason: 'High-risk scenario requires management review',
      };
    }
  }

  // Default: no approval required for standard tickets
  return {
    requiresApproval: false,
    reason: null,
  };
}

// ============================================================================
// TEMPLATE MATCHING (Deterministic SQL)
// ============================================================================

/**
 * Match best gold_response template based on:
 * - Category match (primary)
 * - Action type match
 * - Urgency range compatibility
 * - Risk level compatibility
 */
async function matchTemplate(
  ctx: StrategyContext
): Promise<{
  templateId: string | null;
  templateLabel: string | null;
  templateBody: string | null;
  confidence: number;
  mustInclude: string[];
  mustAvoid: string[];
}> {
  const { category, urgency, riskLevel } = ctx.ticket;
  const actionType = determineActionType(ctx);

  // Query best-matching template (mustInclude/mustAvoid added)
  const sqlQuery = neon(process.env.DATABASE_URL!);
  
  // Query best-matching template (mustInclude/mustAvoid added)
  const matches = await sqlQuery`
    SELECT
      id,
      title,
      body_template as "bodyTemplate",
      category,
      action_type as "actionType",
      appropriate_urgency_min as "appropriateUrgencyMin",
      appropriate_urgency_max as "appropriateUrgencyMax",
      appropriate_risk_levels as "appropriateRiskLevels",
      must_include as "mustInclude",
      must_avoid as "mustAvoid"
    FROM gold_responses
    WHERE category = ${category}
      AND action_type = ${actionType}
      AND is_active = true
      AND (appropriate_urgency_min IS NULL OR ${urgency} >= appropriate_urgency_min)
      AND (appropriate_urgency_max IS NULL OR ${urgency} <= appropriate_urgency_max)
      AND (array_length(appropriate_risk_levels, 1) IS NULL OR ${riskLevel} = ANY(appropriate_risk_levels))
    ORDER BY use_count DESC
    LIMIT 1
  `;

  if (matches.length === 0) {
    // No exact match: try category-only match (fallback)
    const fallbackMatches = await sqlQuery`
      SELECT
        id,
        title,
        body_template as "bodyTemplate",
        must_include as "mustInclude",
        must_avoid as "mustAvoid"
      FROM gold_responses
      WHERE category = ${category}
        AND is_active = true
      ORDER BY use_count DESC
      LIMIT 1
    `;

    if (fallbackMatches.length > 0) {
      return {
        templateId: fallbackMatches[0].id,
        templateLabel: fallbackMatches[0].title,
        templateBody: fallbackMatches[0].bodyTemplate,
        confidence: 60, // Lower confidence for fallback
        mustInclude: (fallbackMatches[0].mustInclude as string[]) || [],
        mustAvoid: (fallbackMatches[0].mustAvoid as string[]) || [],
      };
    }

    return {
      templateId: null,
      templateLabel: null,
      templateBody: null,
      confidence: 0,
      mustInclude: [],
      mustAvoid: [],
    };
  }

  const match = matches[0];
  let confidence = 85; // Base confidence for exact match

  // Boost confidence for high-quality matches
  if (match.appropriateUrgencyMin !== null && match.appropriateUrgencyMax !== null) {
    confidence += 10;
  }
  if (match.appropriateRiskLevels !== null && match.appropriateRiskLevels.length > 0) {
    confidence += 5;
  }

  return {
    templateId: match.id,
    templateLabel: match.title,
    templateBody: match.bodyTemplate,
    confidence: Math.min(confidence, 100),
    mustInclude: (match.mustInclude as string[]) || [],
    mustAvoid: (match.mustAvoid as string[]) || [],
  };
}

// ============================================================================
// BUILD DRIVERS (Why This Strategy)
// ============================================================================

function buildDrivers(ctx: StrategyContext, actionType: string, templateConfidence: number): string[] {
  const drivers: string[] = [];
  const { category, urgency, riskLevel } = ctx.ticket;
  const { isRepeatContact, isHighAttentionCustomer, totalContactCount, lastContactCategory, shopifyLtv } = ctx.customer;

  // Category driver
  drivers.push(`Category: ${category.replace(/_/g, ' ')}`);

  // Urgency driver
  if (urgency >= 8) {
    drivers.push('High urgency (8+)');
  } else if (urgency >= 5) {
    drivers.push('Moderate urgency (5-7)');
  }

  // Risk driver
  if (riskLevel === 'high') {
    drivers.push('High risk assessment');
  }

  // Customer pattern drivers
  if (isRepeatContact) {
    drivers.push('Repeat customer');
  }

  if (isHighAttentionCustomer) {
    drivers.push('High attention customer');
  }

  if (totalContactCount >= 5) {
    drivers.push(`Frequent contact (${totalContactCount} total)`);
  }

  if (lastContactCategory) {
    drivers.push(`Previous contact: ${lastContactCategory}`);
  }

  if (shopifyLtv && (typeof shopifyLtv === 'number' ? shopifyLtv : parseFloat(shopifyLtv)) > 500) {
    drivers.push('High LTV customer');
  }

  // Template confidence driver
  if (templateConfidence >= 90) {
    drivers.push('Strong template match');
  } else if (templateConfidence < 70) {
    drivers.push('Weak template match (fallback)');
  }

  // Action type driver
  drivers.push(`Action: ${actionType.replace(/_/g, ' ')}`);

  return drivers;
}

// ============================================================================
// BUILD RATIONALE (Human-Readable Explanation)
// ============================================================================

function buildRationale(ctx: StrategyContext, actionType: string, drivers: string[]): string {
  const { category } = ctx.ticket;
  const { isRepeatContact, isHighAttentionCustomer } = ctx.customer;

  let rationale = `Customer enquiry in ${category.replace(/_/g, ' ')} category`;

  if (isRepeatContact || isHighAttentionCustomer) {
    rationale += '. ';
    const flags = [];
    if (isRepeatContact) flags.push('repeat contact');
    if (isHighAttentionCustomer) flags.push('high attention');
    rationale += flags.join(' + ').toUpperCase();
  }

  rationale += `. Recommended ${actionType.replace(/_/g, ' ')} based on `;
  rationale += drivers.slice(0, 3).join(', ').toLowerCase();
  rationale += '.';

  return rationale;
}

// ============================================================================
// BUILD RECOMMENDED ACTION (Concise Operational Instruction)
// ============================================================================

/**
 * Build concise recommended action (what the human should DO).
 * This is different from rationale (WHY we're doing it).
 */
function buildRecommendedAction(actionType: string, category: string): string {
  const actionMap: Record<string, string> = {
    arrange_replacement: 'Arrange replacement and request photo evidence if required',
    process_refund: 'Process return/refund request according to policy',
    provide_information: 'Provide accurate information to resolve enquiry',
    escalate: 'Escalate to appropriate team or specialist',
    request_info: 'Request additional information from customer to proceed',
    decline_request: 'Decline request politely with policy explanation',
    acknowledge_feedback: 'Acknowledge and thank customer for feedback',
    route_to_team: 'Route to appropriate team for handling',
  };

  // Category-specific refinements
  const categoryRefinements: Record<string, string> = {
    damaged_missing_faulty: 'Arrange replacement and request photo evidence if required',
    shipping_delivery_order_issue: 'Provide tracking information and delivery status',
    return_refund_exchange: 'Process return request according to policy',
    pre_purchase_question: 'Answer product questions to support purchase decision',
    stock_availability: 'Check stock levels and provide availability information',
    product_usage_guidance: 'Provide assembly instructions or usage guidance',
    order_modification_cancellation: 'Check order status and assist with modification/cancellation',
    account_billing_payment: 'Review payment details and assist with billing issue',
    partnership_wholesale_press: 'Evaluate partnership opportunity and respond appropriately',
    brand_feedback_general: 'Acknowledge and thank customer for feedback',
    praise_testimonial_ugc: 'Thank customer for their positive feedback',
    spam_solicitation: 'Decline request politely with policy explanation',
    other_uncategorized: 'Review enquiry and respond appropriately',
  };

  // Use category-specific refinement if available, otherwise use action type
  return categoryRefinements[category] || actionMap[actionType] || 'Review and respond appropriately';
}

// ============================================================================
// BUILD MUST INCLUDE / MUST AVOID (Category-Based Rules)
// ============================================================================

function buildConstraints(ctx: StrategyContext, template: any): { mustInclude: string[]; mustAvoid: string[] } {
  const { category } = ctx.ticket;
  const mustInclude: string[] = [];
  const mustAvoid: string[] = [];

  // Start with template metadata (if available)
  if (template.mustInclude && Array.isArray(template.mustInclude) && template.mustInclude.length > 0) {
    mustInclude.push(...template.mustInclude);
  }
  if (template.mustAvoid && Array.isArray(template.mustAvoid) && template.mustAvoid.length > 0) {
    mustAvoid.push(...template.mustAvoid);
  }

  // Add category-specific defaults (only if not already in template)
  // Category-specific constraints
  switch (category) {
    case 'damaged_missing_faulty':
      if (!mustInclude.some(i => i.includes('photo'))) {
        mustInclude.push('Photo evidence request (if applicable)');
      }
      if (!mustInclude.some(i => i.includes('replacement') || i.includes('refund'))) {
        mustInclude.push('Replacement or refund options');
      }
      if (!mustAvoid.some(a => a.includes('apolog') || a.includes('sorry'))) {
        mustAvoid.push('No apologies ("sorry", "apologize")');
      }
      if (!mustAvoid.some(a => a.includes('promises'))) {
        mustAvoid.push('No promises not in policy');
      }
      break;

    case 'shipping_delivery_order_issue':
      mustInclude.push('Current status or tracking information');
      mustInclude.push('Expected resolution timeline');
      mustAvoid.push('No specific delivery guarantees unless confirmed');
      break;

    case 'return_refund_exchange':
      mustInclude.push('Return process explanation');
      mustInclude.push('Refund timeline if applicable');
      mustAvoid.push('No guarantees outside policy terms');
      break;

    case 'account_billing_payment':
      mustInclude.push('Next steps or resolution');
      mustAvoid.push('No access to sensitive account details via email');
      break;

    case 'product_usage_guidance':
      mustInclude.push('Clear usage instructions');
      mustInclude.push('Safety warnings if applicable');
      break;

    case 'pre_purchase_question':
      mustInclude.push('Answer to specific question');
      mustInclude.push('Relevant product information');
      break;

    case 'stock_availability':
      mustInclude.push('Stock status or timeline');
      mustInclude.push('Alternative options if out of stock');
      break;

    case 'praise_testimonial_ugc':
      mustInclude.push('Thank you for feedback');
      mustAvoid.push('No automated-sounding responses');
      break;

    case 'spam_solicitation':
      mustInclude.push('Professional decline');
      mustInclude.push('Unsubscribe option if marketing');
      mustAvoid.push('No engagement with solicitation');
      break;

    default:
      mustInclude.push('Helpful, relevant information');
      mustAvoid.push('No policy promises');
  }

  // Global Sagitine tone rules
  mustAvoid.push('No over-apologizing');
  mustAvoid.push('No "I apologize" or "We apologize"');
  mustAvoid.push('No invented policies or promises');

  // Merge with template constraints if available
  if (template?.mustInclude && Array.isArray(template.mustInclude)) {
    mustInclude.push(...template.mustInclude);
  }
  if (template?.mustAvoid && Array.isArray(template.mustAvoid)) {
    mustAvoid.push(...template.mustAvoid);
  }

  // Dedupe (simple approach without Set)
  const uniqueMustInclude: string[] = [];
  const seenInclude = new Set();
  for (const item of mustInclude) {
    if (!seenInclude.has(item)) {
      seenInclude.add(item);
      uniqueMustInclude.push(item);
    }
  }

  const uniqueMustAvoid: string[] = [];
  const seenAvoid = new Set();
  for (const item of mustAvoid) {
    if (!seenAvoid.has(item)) {
      seenAvoid.add(item);
      uniqueMustAvoid.push(item);
    }
  }

  return {
    mustInclude: uniqueMustInclude,
    mustAvoid: uniqueMustAvoid,
  };
}

// ============================================================================
// GENERATE SUMMARY (Haiku - Controlled)
// ============================================================================

/**
 * Generate concise summary using Haiku.
 * Synthesizes customer intent + strategy context into 1-2 sentences.
 */
async function generateSummary(ctx: StrategyContext, strategy: ResponseStrategy): Promise<string> {
  const { email, customer } = ctx;

  const prompt = `Summarize this customer enquiry and our planned response in 1-2 sentences.

FROM: ${customer.name || customer.email}
SUBJECT: ${email.subject}

ENQUIRY:
${email.bodyPlain.substring(0, 500)}

OUR RESPONSE STRATEGY:
- Action: ${strategy.recommendedAction}
- Drivers: ${strategy.drivers.slice(0, 3).join(', ')}

Return a concise summary only (no preamble, no JSON). Example:
"Customer reports damaged product and needs replacement. High urgency due to gift timing."
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 150,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }
  } catch (error) {
    console.error('Summary generation error:', error);
  }

  // Fallback: Construct summary deterministically
  return `Customer enquiry re: ${email.subject}. ${strategy.recommendedAction}.`;
}

// ============================================================================
// MAIN STRATEGY GENERATION FUNCTION
// ============================================================================

/**
 * Generate complete response strategy for a ticket.
 *
 * Returns strategy object + persists to response_strategies table.
 */
export async function generateResponseStrategy(ticketId: string): Promise<ResponseStrategy> {
  // 1. Load context
  const sqlQuery = neon(process.env.DATABASE_URL!);
  const ticketDataRaw = await sqlQuery`
    SELECT
      t.id as ticket_id,
      tr.category_primary as category,
      tr.urgency,
      tr.risk_level as "riskLevel",
      tr.confidence,
      ie.from_email as customer_email,
      ie.from_name as customer_name,
      ie.subject,
      ie.body_plain as "bodyPlain",
      ie.received_at as "receivedAt",
      cp.is_repeat_contact as is_repeat_contact,
      cp.is_high_attention_customer as is_high_attention_customer,
      cp.total_contact_count as total_contact_count,
      cp.last_contact_category as last_contact_category,
      cp.shopify_order_count as shopify_order_count,
      cp.shopify_ltv as shopify_ltv
    FROM tickets t
    INNER JOIN triage_results tr ON t.triage_result_id = tr.id
    INNER JOIN inbound_emails ie ON t.email_id = ie.id
    LEFT JOIN customer_profiles cp ON ie.from_email = cp.email
    WHERE t.id = ${ticketId}
    LIMIT 1
  `;
  const ticketData = ticketDataRaw[0];

  if (!ticketData) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  const ctx: StrategyContext = {
    ticket: {
      id: ticketData.ticket_id,
      category: ticketData.category,
      urgency: ticketData.urgency,
      riskLevel: ticketData.riskLevel,
      confidence: parseFloat(ticketData.confidence),
    },
    customer: {
      email: ticketData.customer_email,
      name: ticketData.customer_name,
      isRepeatContact: ticketData.is_repeat_contact || false,
      isHighAttentionCustomer: ticketData.is_high_attention_customer || false,
      totalContactCount: ticketData.total_contact_count || 0,
      lastContactCategory: ticketData.last_contact_category,
      shopifyOrderCount: ticketData.shopify_order_count,
      shopifyLtv: ticketData.shopify_ltv ? parseFloat(ticketData.shopify_ltv) : null,
    },
    email: {
      subject: ticketData.subject,
      bodyPlain: ticketData.bodyPlain,
      receivedAt: ticketData.receivedAt,
    },
  };

  // 2. Determine action type (deterministic)
  const actionType = determineActionType(ctx);

  // 3. Match template (deterministic SQL)
  const templateMatch = await matchTemplate(ctx);

  // 4. Build drivers
  const drivers = buildDrivers(ctx, actionType, templateMatch.confidence);

  // 5. Build rationale
  const rationale = buildRationale(ctx, actionType, drivers);

  // 6. Build constraints
  const { mustInclude, mustAvoid } = buildConstraints(ctx, templateMatch);

  // 7. Build customer context snapshot
  const customerContext = {
    isRepeatContact: ctx.customer.isRepeatContact,
    isHighAttentionCustomer: ctx.customer.isHighAttentionCustomer,
    totalContactCount: ctx.customer.totalContactCount,
    shopifyOrderCount: ctx.customer.shopifyOrderCount,
    shopifyLtv: ctx.customer.shopifyLtv,
  };

  // 8. Build recommended action (concise operational instruction)
  const recommendedAction = buildRecommendedAction(actionType, ctx.ticket.category);

  // 9. Detect management escalation requirements (pre-launch safety)
  const escalationDetection = detectManagementEscalation(ctx);
  let finalActionType = actionType;

  // If management approval is required, escalate to ensure review before send
  if (escalationDetection.requiresApproval && actionType !== 'escalate') {
    finalActionType = 'escalate';
  }

  // 10. Initial strategy object (before summary generation)
  const strategy: ResponseStrategy = {
    summary: '', // Will be generated next
    recommendedAction, // Concise action instruction (separate from rationale)
    actionType: finalActionType,
    matchedTemplateId: templateMatch.templateId,
    matchedTemplateLabel: templateMatch.templateLabel,
    matchedTemplateConfidence: templateMatch.confidence,
    drivers,
    rationale, // Full explanation (WHY we're doing this)
    draftTone: 'warm_professional',
    mustInclude,
    mustAvoid,
    customerContext,
    templateBody: templateMatch.templateBody,
    // Management escalation guardrail (pre-launch safety)
    requiresManagementApproval: escalationDetection.requiresApproval,
    managementEscalationReason: escalationDetection.reason,
  };

  // 11. Generate summary (Haiku)
  try {
    strategy.summary = await generateSummary(ctx, strategy);
  } catch (error) {
    console.error('Summary generation failed, using fallback:', error);
    strategy.summary = `Customer enquiry: ${ctx.email.subject}. ${finalActionType}.`;
  }

  // 12. Persist to response_strategies table
  await sqlQuery`
    INSERT INTO response_strategies (
      ticket_id, summary, recommended_action, action_type,
      matched_template_id, matched_template_confidence, drivers,
      rationale, draft_tone, must_include, must_avoid,
      customer_context, requires_management_approval,
      management_escalation_reason, strategy_source, generated_by
    ) VALUES (
      ${ticketId},
      ${strategy.summary},
      ${strategy.recommendedAction},
      ${strategy.actionType},
      ${strategy.matchedTemplateId},
      ${strategy.matchedTemplateConfidence},
      ${JSON.stringify(strategy.drivers)},
      ${strategy.rationale},
      ${strategy.draftTone},
      ${JSON.stringify(strategy.mustInclude)},
      ${JSON.stringify(strategy.mustAvoid)},
      ${JSON.stringify(strategy.customerContext)},
      ${strategy.requiresManagementApproval},
      ${strategy.managementEscalationReason},
      'deterministic',
      'response_strategy_service'
    )
  `;

  return strategy;
}
