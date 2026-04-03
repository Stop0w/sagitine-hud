Absolutely — below are **both**:

1. a **new master prompt / comprehensive brief** you can paste as the first instruction to the developer, and  
2. a **matching code implementation** for `api/classify.ts` plus `scripts/evaluate-email-classifier.ts`.

The direction is to use your ~1,500 historical emails as the basis for a proper benchmark and prompt examples, because that is the fastest way to fix classification quality with real data rather than guessing from 10 test emails. [platform.claude](https://platform.claude.com/docs/en/about-claude/use-case-guides/ticket-routing)

## Master prompt

Use this as the new first instruction to the developer:

```text
You are rebuilding Sagitine’s inbound email classification system.

Context:
- The current production classifier is failing badly because it uses brittle keyword matching.
- We have approximately 1,500 historical emails sitting in the database.
- The immediate goal is to fix classification correctness first.
- Do NOT optimise for fancy reply generation yet.
- Do NOT keep patching the current text.includes() logic except for a tiny obvious-spam prefilter.
- This is an email classification task only, not a website, agent, or broader support workflow task.

Primary objective:
Build a robust, production-safe email classification pipeline that:
1. classifies each inbound email into exactly ONE primary category,
2. uses our historical email data to create a gold-standard benchmark,
3. uses Claude as the primary classifier,
4. returns schema-valid JSON,
5. avoids forcing weak guesses by using confidence thresholds,
6. can be evaluated offline against labelled data before deployment.

Required taxonomy:
- shipping_delivery_order_issue
- damaged_missing_faulty
- pre_purchase_question
- return_refund_exchange
- order_modification_cancellation
- account_billing_payment
- partnership_wholesale_press
- praise_testimonial_ugc
- product_usage_guidance
- stock_availability
- spam_solicitation
- other_uncategorized

Non-negotiable requirements:
- Stop iterating on the current keyword tree.
- Use the 1,500 historical emails to build a manually reviewed gold-standard benchmark.
- Split the benchmark into:
  - few-shot prompt examples
  - holdout evaluation set
- Never evaluate only on the same examples included in the prompt.
- Keep classification separate from high-quality draft generation for now.
- Add an offline evaluation script so every prompt change can be measured before deploy.
- Use low temperature for classification consistency.
- Use strict JSON output and validate it server-side.
- If model confidence is weak, route to other_uncategorized / manual review rather than guessing.

Implementation plan:
Phase 1: Export and inspect historical emails
- Pull historical emails from the DB.
- Normalise subject/body/sender/date fields.
- Identify obvious category clusters and ambiguous edge cases.
- Build a labelled benchmark set from representative emails.

Phase 2: Create gold-standard labelled benchmark
- Manually review and label benchmark emails.
- Include difficult edge cases, not just easy examples.
- Explicitly capture confusing pairs:
  - shipping vs damaged
  - cancellation vs pre-purchase
  - wholesale vs spam
  - praise vs product usage
  - stock vs wholesale
  - ambiguous vs other real categories
- Create a holdout set that is not used in prompt examples.

Phase 3: Replace production classifier
- Refactor api/classify.ts to:
  - validate payload
  - run only a tiny deterministic spam prefilter
  - call Claude as the main classifier
  - use structured prompt sections:
    <instructions>
    <categories>
    <decision_rules>
    <examples>
    <email>
  - return JSON matching a fixed schema
  - apply confidence gating
- Do not combine classification with long-form response generation logic in the same first-pass decision.

Phase 4: Add evaluation harness
- Build scripts/evaluate-email-classifier.ts
- It must:
  - load labelled benchmark data
  - call the same classification function as production
  - compare predicted vs expected
  - output:
    - overall accuracy
    - per-category accuracy
    - confusion counts
    - low-confidence count
    - examples of failed predictions
- This script must be runnable before every deployment.

Phase 5: Deploy only after benchmark passes
- Do not deploy based on anecdotal testing alone.
- Only deploy when the classifier performs reliably on the holdout set and on the previously failed production-style examples.

Technical requirements:
- Use @anthropic-ai/sdk
- Use Claude Haiku first for classification
- Keep the model configurable via env var
- Use temperature: 0
- Return exactly one primary category
- Add confidence and manual_review_required flags
- Keep output machine-usable and stable

Expected deliverables:
1. New api/classify.ts
2. New scripts/evaluate-email-classifier.ts
3. Benchmark data format definition (JSON)
4. Clear notes in code showing where gold-standard examples should be inserted from DB-labelled emails

Important guidance:
- The likely root problem is not only the prompt; it is that the current system has not been grounded in enough representative historical emails.
- Use the DB corpus to drive category definitions, examples, and evaluation.
- Correct classification is the only success metric for this phase.
```

## Code

Below is a production-oriented starting point.

### `api/classify.ts`

```ts
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

export interface EmailPayload {
  from_email: string;
  from_name?: string;
  subject: string;
  body_plain: string;
  timestamp: string;
}

export interface ClassificationResult {
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
  manual_review_required: boolean;
  classifier_version: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

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

function buildReplySubject(subject: string): string {
  return subject?.trim() ? `Re: ${subject.trim()}` : 'Re: Your email';
}

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

function obviousSpamPrefilter(text: string): ClassificationResult | null {
  const t = text.toLowerCase();

  const spamSignals = [
    'guaranteed revenue',
    '10x revenue',
    'jump on a call',
    'seo services',
    'lead generation',
    'backlinks',
    'guest post',
    'increase your traffic',
    'cold outreach',
  ];

  const matches = spamSignals.filter((signal) => t.includes(signal));
  if (matches.length < 2) return null;

  return {
    category_primary: 'spam_solicitation',
    confidence: 0.99,
    urgency: 1,
    risk_level: 'low',
    customer_intent_summary: 'Obvious unsolicited marketing or sales outreach',
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

function buildPrompt(payload: EmailPayload): string {
  const { from_email, from_name = '', subject, body_plain, timestamp } = payload;

  return `
<instructions>
You are Sagitine's inbound email classification system.
Classify the email into exactly one primary category.
Optimise for the customer's actual intent, not isolated keywords.
Use the whole email context.
If unclear, prefer other_uncategorized over a weak guess.
Return only valid JSON.
Use Australian English understanding.
</instructions>

<categories>
<category name="shipping_delivery_order_issue">
Customer is asking where their order is, why delivery is delayed, whether it has shipped, or for tracking or arrival updates.
Do not use for damaged goods unless delay is clearly the main issue.
</category>

<category name="damaged_missing_faulty">
Customer reports a damaged, scratched, broken, missing, incomplete, defective, or faulty product.
</category>

<category name="pre_purchase_question">
Customer has not yet purchased and is asking before buying.
</category>

<category name="return_refund_exchange">
Customer wants a return, refund, exchange, or to send an item back after purchase.
</category>

<category name="order_modification_cancellation">
Customer wants to cancel, stop, change, amend, or update an existing order before fulfilment.
</category>

<category name="account_billing_payment">
Customer has a payment, charge, invoice, billing, or account payment issue.
</category>

<category name="partnership_wholesale_press">
Legitimate wholesale, stockist, retailer, collaboration, influencer, partnership, media, or press enquiry relevant to the brand.
Do not use for generic SEO, sales, or marketing spam.
</category>

<category name="praise_testimonial_ugc">
Positive feedback, compliments, appreciation, reviews, testimonials, or user-generated-content offers.
</category>

<category name="product_usage_guidance">
How to use, care for, clean, assemble, or troubleshoot the product.
</category>

<category name="stock_availability">
Question about stock levels, variant availability, or restock timing.
</category>

<category name="spam_solicitation">
Unsolicited irrelevant sales outreach, SEO offers, lead generation, backlinks, or spam.
</category>

<category name="other_uncategorized">
Use only if the message does not fit clearly elsewhere.
</category>
</categories>

<decision_rules>
1. Output exactly one category_primary.
2. Prefer the main customer intent over surface words.
3. If two categories seem plausible, choose the one that best reflects what a human support person should do next.
4. Lower confidence if the message is mixed-intent, vague, or short.
5. Never classify obvious spam as partnership_wholesale_press.
6. Never classify cancellation as pre_purchase_question if an order already exists.
7. Never classify praise as product_usage_guidance unless the main ask is instructional.
8. If uncertain, use other_uncategorized.
9. Return only JSON.
</decision_rules>

<examples>
<!-- Replace these with real gold-standard examples from the historical DB once labelled -->

<example>
<input>
Subject: Where is my order?
Body: Hi, I ordered this 8 days ago and it still hasn't arrived. Can you please check?
</input>
<output>
{"category_primary":"shipping_delivery_order_issue","confidence":0.98,"urgency":8,"risk_level":"medium","customer_intent_summary":"Customer wants an update on a delayed order that has not arrived","recommended_next_action":"Check tracking and provide a delivery update"}
</output>
</example>

<example>
<input>
Subject: Lid scratched on arrival
Body: My order arrived today but the lid is scratched and it was meant to be a gift.
</input>
<output>
{"category_primary":"damaged_missing_faulty","confidence":0.99,"urgency":9,"risk_level":"high","customer_intent_summary":"Customer received a damaged item and needs a remedy","recommended_next_action":"Review the damage issue and arrange a suitable resolution"}
</output>
</example>

<example>
<input>
Subject: Please cancel urgently
Body: I placed an order this morning and need to cancel it immediately before it ships.
</input>
<output>
{"category_primary":"order_modification_cancellation","confidence":0.99,"urgency":10,"risk_level":"high","customer_intent_summary":"Customer urgently wants to cancel an existing order before fulfilment","recommended_next_action":"Check fulfilment status and attempt cancellation immediately"}
</output>
</example>

<example>
<input>
Subject: Charged twice
Body: I think my card has been charged twice for the same order. Can you help?
</input>
<output>
{"category_primary":"account_billing_payment","confidence":0.98,"urgency":8,"risk_level":"high","customer_intent_summary":"Customer is reporting a duplicate charge or billing issue","recommended_next_action":"Review billing records and assist with the payment issue"}
</output>
</example>

<example>
<input>
Subject: Wholesale enquiry
Body: We run a boutique in Melbourne and would like to learn more about your wholesale terms.
</input>
<output>
{"category_primary":"partnership_wholesale_press","confidence":0.97,"urgency":4,"risk_level":"low","customer_intent_summary":"Potential stockist is requesting wholesale information","recommended_next_action":"Respond or route to the relevant wholesale contact"}
</output>
</example>

<example>
<input>
Subject: Love my order
Body: Just wanted to say I absolutely love the product and would be happy to share some photos on Instagram.
</input>
<output>
{"category_primary":"praise_testimonial_ugc","confidence":0.98,"urgency":2,"risk_level":"low","customer_intent_summary":"Happy customer is sharing praise and offering user-generated content","recommended_next_action":"Acknowledge the feedback warmly"}
</output>
</example>

<example>
<input>
Subject: SEO partnership
Body: We can increase your traffic and revenue. Want to jump on a call about our SEO packages?
</input>
<output>
{"category_primary":"spam_solicitation","confidence":0.99,"urgency":1,"risk_level":"low","customer_intent_summary":"Unsolicited marketing outreach unrelated to genuine customer support","recommended_next_action":"Ignore or mark as spam"}
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

I’m sorry for the delay. We’re checking the shipment status now and will come back to you shortly with an update.

Warm regards,
Sagitine Team`;

    case 'damaged_missing_faulty':
      return `Hi ${firstName},

I’m so sorry to hear your item has not arrived in perfect condition.

If you can send through your order number and a photo of the issue, we’ll review it as a priority and help with the next step.

Warm regards,
Sagitine Team`;

    case 'pre_purchase_question':
      return `Hi ${firstName},

Thank you for your interest in Sagitine.

We’d be very happy to help with your question before you place an order.

Warm regards,
Sagitine Team`;

    case 'return_refund_exchange':
      return `Hi ${firstName},

Thank you for getting in touch regarding a return or refund.

If you can share your order number and a brief note on what you’d like to return or exchange, we’ll guide you through the next step.

Warm regards,
Sagitine Team`;

    case 'order_modification_cancellation':
      return `Hi ${firstName},

Thank you for your message.

We understand this may be time-sensitive. Please send through your order number if you haven’t already, and we’ll review the order status as quickly as possible.

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

We truly appreciate you taking the time to share your feedback.

Warm regards,
Sagitine Team`;

    case 'product_usage_guidance':
      return `Hi ${firstName},

Thank you for your message.

We’d be happy to help with product guidance and will point you in the right direction.

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

export async function classifyWithClaude(payload: EmailPayload): Promise<ClassificationResult> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 700,
    messages: [
      {
        role: 'user',
        content: buildPrompt(payload),
      },
    ],
  });

  const rawText = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Claude returned non-JSON output');
  }

  if (!isValidCategory(parsed.category_primary)) {
    throw new Error('Invalid category returned');
  }

  let category = parsed.category_primary as CategoryPrimary;
  const confidence = normaliseConfidence(parsed.confidence);
  const urgency = normaliseUrgency(parsed.urgency);
  const riskLevel = normaliseRiskLevel(parsed.risk_level);

  let manualReviewRequired = false;
  if (confidence < 0.75) {
    category = 'other_uncategorized';
    manualReviewRequired = true;
  } else if (confidence < 0.9) {
    manualReviewRequired = true;
  }

  return {
    category_primary: category,
    confidence,
    urgency,
    risk_level: riskLevel,
    customer_intent_summary:
      typeof parsed.customer_intent_summary === 'string' && parsed.customer_intent_summary.trim()
        ? parsed.customer_intent_summary.trim()
        : 'Customer intent requires review',
    recommended_next_action:
      typeof parsed.recommended_next_action === 'string' && parsed.recommended_next_action.trim()
        ? parsed.recommended_next_action.trim()
        : 'Review manually',
    safe_to_auto_draft: category !== 'spam_solicitation' && confidence >= 0.75,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: [],
    reply_subject: category === 'spam_solicitation' ? '' : buildReplySubject(payload.subject),
    reply_body: buildDraft(category, payload),
    manual_review_required: manualReviewRequired,
    classifier_version: 'claude-email-classifier-v2',
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

  if (req.method === 'OPTIONS') return res.status(200).end();

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

    if (!rawBody?.from_email || !rawBody?.subject || !rawBody?.body_plain || !rawBody?.timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from_email, subject, body_plain, timestamp',
        timestamp: new Date().toISOString(),
      });
    }

    const combinedText = `${rawBody.subject}\n\n${rawBody.body_plain}`.trim();
    const spamResult = obviousSpamPrefilter(combinedText);

    if (spamResult) {
      return res.status(200).json({
        success: true,
        data: spamResult,
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
    const rawBody = (req.body || {}) as Partial<EmailPayload>;

    const fallback = fallbackResult(
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
      data: fallback,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### `scripts/evaluate-email-classifier.ts`

```ts
import fs from 'fs';
import path from 'path';
import { classifyWithClaude, EmailPayload } from '../api/classify';

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

interface BenchmarkEmail extends EmailPayload {
  id: string;
  expected_category: CategoryPrimary;
  split?: 'prompt' | 'holdout';
  notes?: string;
}

interface EvalRow {
  id: string;
  expected: CategoryPrimary;
  predicted: CategoryPrimary;
  confidence: number;
  correct: boolean;
  manual_review_required: boolean;
  subject: string;
  notes?: string;
}

async function main() {
  const benchmarkPath = path.join(process.cwd(), 'data', 'email-classification-benchmark.json');
  const raw = fs.readFileSync(benchmarkPath, 'utf8');
  const dataset = JSON.parse(raw) as BenchmarkEmail[];

  const holdout = dataset.filter((row) => row.split !== 'prompt');

  if (holdout.length === 0) {
    throw new Error('No holdout rows found in benchmark dataset');
  }

  const rows: EvalRow[] = [];
  const confusion: Record<string, number> = {};
  const perCategory: Record<string, { total: number; correct: number }> = {};

  for (const email of holdout) {
    const result = await classifyWithClaude(email);

    const correct = result.category_primary === email.expected_category;
    rows.push({
      id: email.id,
      expected: email.expected_category,
      predicted: result.category_primary,
      confidence: result.confidence,
      correct,
      manual_review_required: result.manual_review_required,
      subject: email.subject,
      notes: email.notes,
    });

    if (!perCategory[email.expected_category]) {
      perCategory[email.expected_category] = { total: 0, correct: 0 };
    }
    perCategory[email.expected_category].total += 1;
    if (correct) perCategory[email.expected_category].correct += 1;

    if (!correct) {
      const key = `${email.expected_category} -> ${result.category_primary}`;
      confusion[key] = (confusion[key] || 0) + 1;
    }
  }

  const correctCount = rows.filter((r) => r.correct).length;
  const lowConfidenceCount = rows.filter((r) => r.confidence < 0.75).length;
  const manualReviewCount = rows.filter((r) => r.manual_review_required).length;
  const accuracy = correctCount / rows.length;

  console.log('\n=== Email Classifier Evaluation ===');
  console.log(`Total holdout emails: ${rows.length}`);
  console.log(`Correct: ${correctCount}`);
  console.log(`Accuracy: ${(accuracy * 100).toFixed(2)}%`);
  console.log(`Low confidence (<0.75): ${lowConfidenceCount}`);
  console.log(`Manual review required: ${manualReviewCount}`);

  console.log('\n=== Per-category accuracy ===');
  for (const [category, stats] of Object.entries(perCategory)) {
    const pct = stats.total ? (stats.correct / stats.total) * 100 : 0;
    console.log(`${category}: ${stats.correct}/${stats.total} (${pct.toFixed(2)}%)`);
  }

  console.log('\n=== Top confusion pairs ===');
  Object.entries(confusion)
    .sort((a, b) => b [platform.claude](https://platform.claude.com/docs/en/about-claude/use-case-guides/ticket-routing) - a [platform.claude](https://platform.claude.com/docs/en/about-claude/use-case-guides/ticket-routing))
    .slice(0, 20)
    .forEach(([pair, count]) => {
      console.log(`${pair}: ${count}`);
    });

  console.log('\n=== Failed predictions ===');
  rows
    .filter((r) => !r.correct)
    .slice(0, 50)
    .forEach((r) => {
      console.log(
        `- ${r.id} | expected=${r.expected} predicted=${r.predicted} confidence=${r.confidence} subject=${JSON.stringify(r.subject)}`
      );
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Benchmark file shape

Create:

`data/email-classification-benchmark.json`

Example:

```json
[
  {
    "id": "email_001",
    "from_email": "customer@example.com",
    "from_name": "Sarah",
    "subject": "Where is my order?",
    "body_plain": "I ordered this 8 days ago and it still hasn't arrived.",
    "timestamp": "2026-04-01T10:00:00.000Z",
    "expected_category": "shipping_delivery_order_issue",
    "split": "holdout",
    "notes": "Delayed delivery phrasing"
  },
  {
    "id": "email_002",
    "from_email": "buyer@example.com",
    "from_name": "Emma",
    "subject": "Wholesale enquiry",
    "body_plain": "We own a boutique and would like your wholesale terms.",
    "timestamp": "2026-04-01T10:05:00.000Z",
    "expected_category": "partnership_wholesale_press",
    "split": "prompt",
    "notes": "Legitimate wholesale"
  }
]
```

## Important update

Because you have ~1,500 emails, the **real acceleration move** is not just swapping code — it is using those emails to produce:
- better few-shot examples,
- better category definitions,
- and an actual holdout benchmark. [docs.langchain](https://docs.langchain.com/langsmith/create-few-shot-evaluators)

So I would tell the developer: **ship the benchmark workflow and classifier together**, not classifier alone. [docs.langchain](https://docs.langchain.com/langsmith/create-few-shot-evaluators)

## One final note

The code above uses a JSON-only response pattern for simplicity, but Anthropic’s structured output tooling is also designed for schema-safe responses, which is worth adopting if your current SDK/runtime supports it cleanly. The XML-structured prompt layout also follows Anthropic’s guidance for routing-style tasks because it makes the model’s instructions, categories, and examples much clearer. [techbytes](https://techbytes.app/posts/claude-structured-outputs-json-schema-api/)

**“copy-paste into Claude Code” task brief** with no explanation, just the exact instruction block.