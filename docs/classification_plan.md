Yes — here is a single **developer-ready block** you can hand over. It replaces the keyword classifier with a dedicated Claude-based email classifier using structured prompting, schema-validated JSON output, low-temperature classification, confidence gating, and a tiny deterministic spam pre-filter. This matches Anthropic’s guidance for ticket routing and structured outputs, which is the right pattern for email classification. [platform.claude](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

```ts
// api/classify.ts
// Production email classification endpoint for Sagitine
// Replaces brittle keyword-only routing with Claude-based structured classification
//
// Requirements:
// - npm install @anthropic-ai/sdk
// - Set ANTHROPIC_API_KEY in Vercel env
// - Optional: set ANTHROPIC_MODEL (default below)
//
// Notes:
// - Tiny deterministic pre-filter is kept only for obvious spam
// - Claude performs the real classification
// - Low confidence routes to other_uncategorized instead of forcing a wrong label
// - This endpoint focuses on classification correctness first

import Anthropic from '@anthropic-ai/sdk';

type RiskLevel = 'low' | 'medium' | 'high';

type CategoryPrimary =
  | 'shipping_delivery_order_issue'
  | 'damaged_missing_faulty'
  | 'pre_purchase_question'
  | 'return_refund_exchange'
  | 'order_modification_cancellation'
  | 'account_billing_payment'
  | 'partnership_wholesale_press'
  | 'praise_testimonial_ugc'
  | 'product_usage_guidance'
  | 'stock_availability'
  | 'spam_solicitation'
  | 'other_uncategorized';

interface ClassificationResult {
  category_primary: CategoryPrimary;
  confidence: number;
  urgency: number;
  risk_level: RiskLevel;
  customer_intent_summary: string;
  recommended_next_action: string;
  safe_to_auto_draft: boolean;
  safe_to_auto_send: boolean;
  retrieved_knowledge_ids: string[];
  reply_subject: string;
  reply_body: string | null;
  manual_review_required?: boolean;
  classifier_version?: string;
}

interface EmailPayload {
  from_email: string;
  from_name?: string;
  subject: string;
  body_plain: string;
  timestamp: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
// If that model name is unavailable in your account, switch to the current Haiku model enabled for your Anthropic project.
// Anthropic positions Haiku-class models as a strong fit for ticket routing workloads.

const VALID_CATEGORIES: CategoryPrimary[] = [
  'shipping_delivery_order_issue',
  'damaged_missing_faulty',
  'pre_purchase_question',
  'return_refund_exchange',
  'order_modification_cancellation',
  'account_billing_payment',
  'partnership_wholesale_press',
  'praise_testimonial_ugc',
  'product_usage_guidance',
  'stock_availability',
  'spam_solicitation',
  'other_uncategorized',
];

function normaliseConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normaliseUrgency(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function normaliseRiskLevel(value: unknown): RiskLevel {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function isValidCategory(value: unknown): value is CategoryPrimary {
  return typeof value === 'string' && VALID_CATEGORIES.includes(value as CategoryPrimary);
}

function buildReplySubject(subject: string): string {
  return subject?.trim() ? `Re: ${subject.trim()}` : 'Re: Your email';
}

function obviousSpamPrefilter(text: string): ClassificationResult | null {
  const t = text.toLowerCase();

  const spamSignals = [
    'guaranteed revenue',
    '10x revenue',
    'jump on a call',
    'cold outreach',
    'seo services',
    'lead generation',
    'guest post',
    'backlinks',
    'increase your traffic',
    'collaboration opportunity',
  ];

  const matchedSignals = spamSignals.filter((signal) => t.includes(signal));

  if (matchedSignals.length >= 2) {
    return {
      category_primary: 'spam_solicitation',
      confidence: 0.99,
      urgency: 1,
      risk_level: 'low',
      customer_intent_summary: 'Obvious unsolicited marketing or outreach email',
      recommended_next_action: 'Ignore or mark as spam',
      safe_to_auto_draft: false,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: '',
      reply_body: null,
      manual_review_required: false,
      classifier_version: 'prefilter-v1',
    };
  }

  return null;
}

function buildPrompt(payload: EmailPayload): string {
  const { from_email, from_name = '', subject, body_plain, timestamp } = payload;

  return `
<instructions>
You are an email classification system for Sagitine, a premium consumer brand.
Your job is to classify exactly one inbound email into exactly one primary category.
Optimise for correct customer intent, not keyword matching.
Use the full context of the email.
Do not guess aggressively. If the email is unclear, use other_uncategorized with lower confidence.
Return only a JSON object that matches the schema.
Use Australian English understanding.
</instructions>

<categories>
<category name="shipping_delivery_order_issue">
Use when the customer is asking where their order is, why delivery is delayed, whether an order has shipped, for tracking updates, or when an item has not arrived yet.
Includes wording like: where is my order, still hasn't arrived, delayed, late delivery, tracking, dispatched days ago.
Do not use for damaged goods, refund requests, or cancellation requests unless delivery is clearly the main intent.
</category>

<category name="damaged_missing_faulty">
Use when the customer reports a product arrived damaged, scratched, broken, faulty, defective, incomplete, missing parts, or unusable.
Includes wording like: scratched lid, broken, cracked, faulty, damaged, missing item, wrong item in box.
Do not use for shipping delays unless the item condition or defect is the main issue.
</category>

<category name="pre_purchase_question">
Use when the customer has not purchased yet and is asking a question before buying.
Includes compatibility, materials, sizing, product details, gifting, timing before purchase.
Do not use for questions about an existing order.
</category>

<category name="return_refund_exchange">
Use when the customer wants to return, refund, exchange, send back, or get money back for an order already received or completed.
Do not use for cancellation before shipping if the order has not yet been fulfilled.
</category>

<category name="order_modification_cancellation">
Use when the customer wants to cancel, amend, change, update, or stop an existing order before fulfilment.
Includes urgent cancellation requests and order edits such as address, variant, size, quantity, or item changes.
Do not use for returns after delivery unless they explicitly want a refund or return.
</category>

<category name="account_billing_payment">
Use for card issues, charge disputes, payment failures, invoice questions, duplicate charges, billing questions, and account payment issues.
</category>

<category name="partnership_wholesale_press">
Use for legitimate wholesale, retailer, distributor, partnership, collaboration, influencer, PR, media, or press enquiries that are relevant to the brand.
Do not use for generic cold outreach, SEO sales pitches, lead generation, or spam.
</category>

<category name="praise_testimonial_ugc">
Use for positive feedback, compliments, testimonials, reviews, appreciation, or customer offers to share photos/videos/content.
Includes UGC and praise.
Do not use for usage questions even if the customer also says they like the brand.
</category>

<category name="product_usage_guidance">
Use when the customer is asking how to use, care for, clean, assemble, or troubleshoot a product.
Includes setup or instructional questions.
</category>

<category name="stock_availability">
Use when the customer is asking if something is in stock, when it will restock, or whether a specific variant is available.
Do not use for wholesale supply enquiries.
</category>

<category name="spam_solicitation">
Use for irrelevant unsolicited sales, SEO offers, lead generation, backlink requests, marketing services, cold outreach, or other spam.
Do not use for real wholesale, press, or partnership enquiries.
</category>

<category name="other_uncategorized">
Use only when the message does not clearly fit another category or is too ambiguous to classify confidently.
</category>
</categories>

<decision_rules>
1. Choose exactly one category_primary.
2. Prefer the customer's main intent over surface keywords.
3. If multiple categories appear possible, choose the one that best matches the action a human support agent should take next.
4. Use lower confidence when the email is brief, vague, mixed-intent, or ambiguous.
5. Never classify obvious spam as partnership_wholesale_press.
6. Never classify praise as product_usage_guidance unless the actual request is how to use the product.
7. Never classify cancellation as pre_purchase_question when an order already exists.
8. If uncertain, use other_uncategorized rather than forcing a weak guess.
9. Return only JSON.
</decision_rules>

<examples>
<example>
<input>
Subject: Where is my order?
Body: Hi, I placed my order 8 days ago and it still hasn't arrived. Can you please check what's happening?
</input>
<output>
{"category_primary":"shipping_delivery_order_issue","confidence":0.98,"urgency":8,"risk_level":"medium","customer_intent_summary":"Customer wants an update on a delayed order that has not arrived","recommended_next_action":"Check tracking and provide a delivery update"}
</output>
</example>

<example>
<input>
Subject: Lid arrived scratched
Body: I just opened my parcel and the lid is scratched. Really disappointed as this was a gift.
</input>
<output>
{"category_primary":"damaged_missing_faulty","confidence":0.99,"urgency":9,"risk_level":"high","customer_intent_summary":"Customer received a damaged product and needs a remedy","recommended_next_action":"Request order details and arrange replacement or resolution"}
</output>
</example>

<example>
<input>
Subject: Cancel urgently
Body: Please cancel my order immediately before it ships. I ordered the wrong item by mistake.
</input>
<output>
{"category_primary":"order_modification_cancellation","confidence":0.99,"urgency":10,"risk_level":"high","customer_intent_summary":"Customer urgently wants to cancel an existing order before fulfilment","recommended_next_action":"Check fulfilment status and attempt cancellation immediately"}
</output>
</example>

<example>
<input>
Subject: Billing issue
Body: I think I have been charged twice for the same order. Can someone help me with this?
</input>
<output>
{"category_primary":"account_billing_payment","confidence":0.98,"urgency":8,"risk_level":"high","customer_intent_summary":"Customer is reporting a duplicate payment or billing problem","recommended_next_action":"Review payment records and assist with the billing issue"}
</output>
</example>

<example>
<input>
Subject: Wholesale enquiry
Body: Hello, we run a boutique in Melbourne and would love to learn about your wholesale terms.
</input>
<output>
{"category_primary":"partnership_wholesale_press","confidence":0.97,"urgency":4,"risk_level":"low","customer_intent_summary":"Potential retail partner is requesting wholesale information","recommended_next_action":"Forward or respond with wholesale information"}
</output>
</example>

<example>
<input>
Subject: Love your product
Body: Just wanted to say I absolutely love my order. I took some photos and would be happy to share them on Instagram if helpful.
</input>
<output>
{"category_primary":"praise_testimonial_ugc","confidence":0.98,"urgency":2,"risk_level":"low","customer_intent_summary":"Happy customer is sharing praise and offering user-generated content","recommended_next_action":"Thank the customer warmly and acknowledge the positive feedback"}
</output>
</example>

<example>
<input>
Subject: Available in sage?
Body: Is the large size in sage coming back soon?
</input>
<output>
{"category_primary":"stock_availability","confidence":0.98,"urgency":4,"risk_level":"low","customer_intent_summary":"Customer wants restock information for a specific variant","recommended_next_action":"Check inventory or restock timing and reply with availability information"}
</output>
</example>

<example>
<input>
Subject: Quick question before I buy
Body: I am thinking about ordering one. Is the material dishwasher safe?
</input>
<output>
{"category_primary":"pre_purchase_question","confidence":0.98,"urgency":3,"risk_level":"low","customer_intent_summary":"Potential customer has a product question before purchasing","recommended_next_action":"Answer the pre-purchase product question clearly"}
</output>
</example>

<example>
<input>
Subject: Can you help?
Body: Your site says my payment failed but my bank shows the charge pending.
</input>
<output>
{"category_primary":"account_billing_payment","confidence":0.96,"urgency":7,"risk_level":"high","customer_intent_summary":"Customer has a payment processing or billing concern","recommended_next_action":"Review payment status and explain next steps"}
</output>
</example>

<example>
<input>
Subject: Partnership proposal
Body: We guarantee more traffic and sales for your store. Want to jump on a call about our SEO packages?
</input>
<output>
{"category_primary":"spam_solicitation","confidence":0.99,"urgency":1,"risk_level":"low","customer_intent_summary":"Unsolicited marketing outreach offering irrelevant services","recommended_next_action":"Ignore or mark as spam"}
</output>
</example>
</examples>

<email>
from_email: ${JSON.stringify(from_email)}
from_name: ${JSON.stringify(from_name)}
timestamp: ${JSON.stringify(timestamp)}
subject: ${JSON.stringify(subject)}
body_plain: ${JSON.stringify(body_plain)}
</email>
`.trim();
}

function buildDraft(category: CategoryPrimary, payload: EmailPayload): string | null {
  const customerName = payload.from_name?.trim() || 'there';
  const firstName = customerName.split(' ')[0];

  switch (category) {
    case 'shipping_delivery_order_issue':
      return `Hi ${firstName},

Thank you for getting in touch about your order.

I’m sorry for the delay. We’re checking the status of your shipment now and will come back to you shortly with an update.

Warm regards,
Sagitine Team`;

    case 'damaged_missing_faulty':
      return `Hi ${firstName},

I’m so sorry to hear your item has arrived damaged or not as expected.

If you can send through your order number and a photo of the issue, we’ll review it as a priority and help with the next step.

Warm regards,
Sagitine Team`;

    case 'pre_purchase_question':
      return `Hi ${firstName},

Thank you for your interest in Sagitine.

We’d be very happy to help with your question before you place an order. If there’s any specific detail you’d like clarified, please let us know.

Warm regards,
Sagitine Team`;

    case 'return_refund_exchange':
      return `Hi ${firstName},

Thank you for reaching out regarding a return or refund.

If you can share your order number and a brief note on what you’d like to return or exchange, we’ll review the request and guide you through the next step.

Warm regards,
Sagitine Team`;

    case 'order_modification_cancellation':
      return `Hi ${firstName},

Thank you for your message.

We understand this may be time-sensitive. Please send through your order number if you haven’t already, and we’ll review the order status as quickly as possible to see what changes can still be made.

Warm regards,
Sagitine Team`;

    case 'account_billing_payment':
      return `Hi ${firstName},

Thank you for getting in touch.

We’re sorry to hear there may be a billing or payment issue. Please share any relevant order details and we’ll look into it carefully for you.

Warm regards,
Sagitine Team`;

    case 'partnership_wholesale_press':
      return `Hi ${firstName},

Thank you for reaching out to Sagitine.

We appreciate your enquiry and will make sure it is reviewed by the appropriate team.

Warm regards,
Sagitine Team`;

    case 'praise_testimonial_ugc':
      return `Hi ${firstName},

Thank you so much for your lovely message.

We truly appreciate you taking the time to share your feedback, and we’re delighted to hear you’ve had a positive experience with Sagitine.

Warm regards,
Sagitine Team`;

    case 'product_usage_guidance':
      return `Hi ${firstName},

Thank you for your message.

We’d be happy to help with product guidance. If there’s a specific step or issue you’d like help with, please let us know and we’ll point you in the right direction.

Warm regards,
Sagitine Team`;

    case 'stock_availability':
      return `Hi ${firstName},

Thank you for your enquiry.

We’re checking availability for you now and will come back to you shortly with an update.

Warm regards,
Sagitine Team`;

    case 'spam_solicitation':
      return null;

    case 'other_uncategorized':
    default:
      return `Hi ${firstName},

Thank you for reaching out.

We’ve received your message and will review it carefully before coming back to you.

Warm regards,
Sagitine Team`;
  }
}

async function classifyWithClaude(payload: EmailPayload): Promise<ClassificationResult> {
  const prompt = buildPrompt(payload);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            category_primary: {
              type: 'string',
              enum: VALID_CATEGORIES,
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
            },
            urgency: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
            },
            risk_level: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
            customer_intent_summary: {
              type: 'string',
              minLength: 1,
              maxLength: 240,
            },
            recommended_next_action: {
              type: 'string',
              minLength: 1,
              maxLength: 240,
            },
          },
          required: [
            'category_primary',
            'confidence',
            'urgency',
            'risk_level',
            'customer_intent_summary',
            'recommended_next_action',
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const contentBlock = response.content?.[0];

  let parsed: any = null;

  if (contentBlock && contentBlock.type === 'output_json') {
    parsed = contentBlock.json;
  } else if (contentBlock && contentBlock.type === 'text') {
    parsed = JSON.parse(contentBlock.text);
  } else {
    throw new Error('Claude returned an unexpected response format');
  }

  if (!isValidCategory(parsed.category_primary)) {
    throw new Error('Invalid category returned by classifier');
  }

  let category = parsed.category_primary as CategoryPrimary;
  let confidence = normaliseConfidence(parsed.confidence);
  const urgency = normaliseUrgency(parsed.urgency);
  const riskLevel = normaliseRiskLevel(parsed.risk_level);
  const customerIntentSummary =
    typeof parsed.customer_intent_summary === 'string' && parsed.customer_intent_summary.trim()
      ? parsed.customer_intent_summary.trim()
      : 'Customer intent requires review';
  const recommendedNextAction =
    typeof parsed.recommended_next_action === 'string' && parsed.recommended_next_action.trim()
      ? parsed.recommended_next_action.trim()
      : 'Review and respond appropriately';

  let manualReviewRequired = false;

  // Confidence gating:
  // - < 0.75: do not force a weak guess
  // - 0.75 - 0.89: usable, but manual review recommended
  if (confidence < 0.75) {
    category = 'other_uncategorized';
    confidence = confidence;
    manualReviewRequired = true;
  } else if (confidence < 0.9) {
    manualReviewRequired = true;
  }

  const replyBody = buildDraft(category, payload);

  return {
    category_primary: category,
    confidence,
    urgency,
    risk_level: riskLevel,
    customer_intent_summary: customerIntentSummary,
    recommended_next_action: recommendedNextAction,
    safe_to_auto_draft: category !== 'spam_solicitation' && confidence >= 0.75,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: [],
    reply_subject: category === 'spam_solicitation' ? '' : buildReplySubject(payload.subject),
    reply_body: replyBody,
    manual_review_required: manualReviewRequired,
    classifier_version: 'claude-email-classifier-v1',
  };
}

function fallbackResult(payload: EmailPayload, reason = 'Fallback classification used'): ClassificationResult {
  return {
    category_primary: 'other_uncategorized',
    confidence: 0.3,
    urgency: 5,
    risk_level: 'medium',
    customer_intent_summary: reason,
    recommended_next_action: 'Review manually',
    safe_to_auto_draft: false,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: [],
    reply_subject: buildReplySubject(payload.subject),
    reply_body: buildDraft('other_uncategorized', payload),
    manual_review_required: true,
    classifier_version: 'fallback-v1',
  };
}

export default async function handler(req: any, res: any) {
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
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Missing ANTHROPIC_API_KEY',
        timestamp: new Date().toISOString(),
      });
    }

    const rawBody = req.body as EmailPayload;

    if (
      !rawBody ||
      !rawBody.from_email ||
      !rawBody.subject ||
      !rawBody.body_plain ||
      !rawBody.timestamp
    ) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from_email, subject, body_plain, timestamp',
        timestamp: new Date().toISOString(),
      });
    }

    const combinedText = `${rawBody.subject}\n\n${rawBody.body_plain}`.trim();

    const spamPrefilter = obviousSpamPrefilter(combinedText);
    if (spamPrefilter) {
      return res.status(200).json({
        success: true,
        data: spamPrefilter,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await classifyWithClaude(rawBody);

    return res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const rawBody = (req.body || {}) as EmailPayload;
    const safeFallback = fallbackResult(
      {
        from_email: rawBody.from_email || '',
        from_name: rawBody.from_name || '',
        subject: rawBody.subject || 'Your email',
        body_plain: rawBody.body_plain || '',
        timestamp: rawBody.timestamp || new Date().toISOString(),
      },
      error?.message || 'Classifier error'
    );

    return res.status(200).json({
      success: true,
      data: safeFallback,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Why this is the right replacement

This implementation is better than your current version because it moves the real decision-making from brittle keyword chains to structured intent classification, while still keeping a tiny deterministic layer for obvious spam. It also uses schema-constrained output and confidence gating, which are two of the most important production controls for getting reliable machine-usable classifications instead of fragile chat-style responses. [platform.claude](https://platform.claude.com/docs/en/about-claude/use-case-guides/ticket-routing)

## What the developer should do next

After dropping this in, the developer should run the original 10-email test again, then expand the labelled test set to at least 50 real emails so the prompt can be tuned against actual misses rather than anecdotal examples. If Haiku still misses subtle cases after prompt tuning, then test Sonnet on the same fixed dataset and compare measured accuracy, latency, and cost before upgrading models. [zenml](https://www.zenml.io/llmops-database/email-classification-system-using-foundation-models-and-prompt-engineering)