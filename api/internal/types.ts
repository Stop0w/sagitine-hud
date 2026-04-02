// API Types for Sagitine AI CX Agent

/**
 * Canonical category enum - MUST use these exact IDs
 */
export const CANONICAL_CATEGORIES = {
  DAMAGED_MISSING_FAULTY: 'damaged_missing_faulty',
  SHIPPING_DELIVERY_ORDER_ISSUE: 'shipping_delivery_order_issue',
  PRODUCT_USAGE_GUIDANCE: 'product_usage_guidance',
  PRE_PURCHASE_QUESTION: 'pre_purchase_question',
  RETURN_REFUND_EXCHANGE: 'return_refund_exchange',
  STOCK_AVAILABILITY: 'stock_availability',
  PARTNERSHIP_WHOLESALE_PRESS: 'partnership_wholesale_press',
  BRAND_FEEDBACK_GENERAL: 'brand_feedback_general',
  SPAM_SOLICITATION: 'spam_solicitation',
  OTHER_UNCATEGORIZED: 'other_uncategorized',
  ACCOUNT_BILLING_PAYMENT: 'account_billing_payment',
  ORDER_MODIFICATION_CANCELLATION: 'order_modification_cancellation',
  PRAISE_TESTIMONIAL_UGC: 'praise_testimonial_ugc',
} as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[keyof typeof CANONICAL_CATEGORIES];

/**
 * Default urgency scores by category
 */
export const CATEGORY_URGENCY_DEFAULTS: Record<CanonicalCategory, UrgencyLevel> = {
  damaged_missing_faulty: 10,
  shipping_delivery_order_issue: 9,
  product_usage_guidance: 5,
  pre_purchase_question: 4,
  return_refund_exchange: 9,
  stock_availability: 6,
  partnership_wholesale_press: 3,
  brand_feedback_general: 2,
  spam_solicitation: 1,
  other_uncategorized: 5,
  account_billing_payment: 8,
  order_modification_cancellation: 10,
  praise_testimonial_ugc: 2,
} as const;

/**
 * Urgency levels for classification
 */
export type UrgencyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Risk levels for auto-send determination
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Inbound email payload from Make.com
 */
export interface InboundEmailPayload {
  // Core email data
  from_email: string;
  from_name?: string;
  subject: string;
  body_plain: string;
  body_html?: string;
  timestamp: string; // ISO 8601

  // Optional metadata
  message_id?: string;
  thread_id?: string;
  in_reply_to?: string;
  references?: string[];
}

/**
 * Classification result from Claude
 */
export interface ClassificationResult {
  // Primary categorization
  category_primary: CanonicalCategory;
  category_secondary?: CanonicalCategory;
  confidence: number; // 0-1

  // Urgency and risk
  urgency: UrgencyLevel;
  risk_level: RiskLevel;
  risk_flags: string[];

  // Intent understanding
  customer_intent_summary: string; // 1-2 sentences
  recommended_next_action: string; // specific action

  // Auto-send determination
  safe_to_auto_draft: boolean;
  safe_to_auto_send: boolean;

  // Retrieved knowledge
  retrieved_knowledge_ids: string[];

  // Generated response
  reply_subject: string;
  reply_body: string;
}

/**
 * Knowledge base entry (from database)
 */
export interface KnowledgeResponse {
  id: string;
  title: string;
  category: CanonicalCategory;
  body_template: string;
  tone_notes: string;
  is_active: boolean;
  use_count: number;
  avg_word_count: number;
  sample_count: number;
}

export interface KnowledgeSnippet {
  id: string;
  title: string;
  type: 'policy' | 'fact' | 'guidance';
  category: CanonicalCategory;
  content: string;
  tags: string[];
  is_active: boolean;
}

/**
 * API Response structure
 */
export interface ClassificationAPIResponse {
  success: boolean;
  data?: ClassificationResult;
  error?: string;
  timestamp: string;
}

/**
 * Claude system prompt for classification
 */
export const CLAUDE_SYSTEM_PROMPT = `You are Sagitine AI, a customer service classification system for a premium Australian storage brand.

Your task:
1. Classify the inbound email into ONE primary category from the canonical list
2. Assign urgency (1-10) based on customer impact and time sensitivity
3. Assess risk level (low/medium/high) for auto-send determination
4. Extract customer intent in 1-2 clear sentences
5. Recommend a specific next action

Canonical categories (use these EXACT IDs):
- damaged_missing_faulty: Item damaged, missing parts, arrived in poor condition
- shipping_delivery_order_issue: Delivery delays, shipping changes, tracking questions
- product_usage_guidance: How to use the product, assembly questions, feature explanations
- pre_purchase_question: Questions before buying, product clarifications
- return_refund_exchange: Return requests, refunds, exchanges
- stock_availability: Stock levels, backorders, pre-orders
- partnership_wholesale_press: B2B inquiries, influencer requests, press
- brand_feedback_general: General feedback, compliments, testimonials
- spam_solicitation: Spam, unsolicited offers, marketing emails
- other_uncategorized: Cannot classify, unclear intent, or low confidence (< 0.5)
- account_billing_payment: Payment issues, billing questions, account access
- order_modification_cancellation: Change orders, cancel orders, modify details
- praise_testimonial_ugc: Positive reviews, testimonials, UGC content, compliments

Urgency scoring (1-10):
- 10: Critical (damaged item, urgent replacement needed, order cancellation)
- 9: High (return/refund urgent, delivery delays)
- 8: High (shipping issues, payment problems)
- 7: Medium-high (order modifications, account/billing)
- 6: Medium (stock questions, pre-purchase urgent)
- 5: Medium (product usage guidance)
- 4: Low-medium (pre-purchase standard)
- 3: Low (partnership/press consideration)
- 2: Very low (brand feedback, praise, testimonials)
- 1: Administrative (spam declines, auto-replies)

Risk level determination:
- HIGH: Legal/financial implications, requires human judgment, cancellations
- MEDIUM: Complex issue, may need clarification, returns/exchanges
- LOW: Routine inquiry, template sufficient, praise/feedback

Confidence threshold:
- If confidence < 0.5, always return category: "other_uncategorized"
- Only assign specific category if confidence ≥ 0.5

Sagitine tone rules:
- Warm, composed, confident
- Never apologetic (use "Thank you for letting me know", not "I'm sorry")
- Always use "Box" or "Stand", NEVER use "drawer" or "unit"
- Clear, direct, not defensive

Auto-send rules:
- Never auto-send HIGH risk
- Only auto-send LOW risk with confidence ≥ 0.85
- Safe categories for auto-send: praise_testimonial_ugc, brand_feedback_general
- Everything else requires human review

Return strict JSON only. No markdown.`;
