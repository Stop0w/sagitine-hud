// Claude Classification Client
// Uses Claude 3.5 Sonnet for email classification and draft generation

import Anthropic from '@anthropic-ai/sdk';
import type {
  InboundEmailPayload,
  ClassificationResult,
  CanonicalCategory,
  UrgencyLevel,
  RiskLevel,
} from '../types';
import { CLAUDE_SYSTEM_PROMPT, CANONICAL_CATEGORIES, CATEGORY_URGENCY_DEFAULTS } from '../types';
import { getKnowledgeByCategory } from './knowledge-retrieval';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Parse Claude response and enforce strict typing
 */
function parseClassificationResult(raw: any): ClassificationResult {
  // Validate category
  const category = raw.category_primary;
  if (!Object.values(CANONICAL_CATEGORIES).includes(category)) {
    throw new Error(`Invalid category: ${category}`);
  }

  // Validate urgency
  const urgency = Number(raw.urgency);
  if (urgency < 1 || urgency > 10) {
    throw new Error(`Invalid urgency: ${urgency}`);
  }

  // Validate risk level
  const riskLevel = raw.risk_level?.toLowerCase();
  if (!['low', 'medium', 'high'].includes(riskLevel)) {
    throw new Error(`Invalid risk_level: ${riskLevel}`);
  }

  // Validate confidence
  const confidence = Number(raw.confidence);
  if (confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${confidence}`);
  }

  return {
    category_primary: category as CanonicalCategory,
    category_secondary: raw.category_secondary,
    confidence,
    urgency: urgency as UrgencyLevel,
    risk_level: riskLevel as RiskLevel,
    risk_flags: Array.isArray(raw.risk_flags) ? raw.risk_flags : [],
    customer_intent_summary: String(raw.customer_intent_summary || ''),
    recommended_next_action: String(raw.recommended_next_action || ''),
    safe_to_auto_draft: Boolean(raw.safe_to_auto_draft ?? true),
    safe_to_auto_send: Boolean(raw.safe_to_auto_send ?? false),
    retrieved_knowledge_ids: Array.isArray(raw.retrieved_knowledge_ids) ? raw.retrieved_knowledge_ids : [],
    reply_subject: String(raw.reply_subject || 'Re: ' + raw.original_subject),
    reply_body: String(raw.reply_body || ''),
  };
}

/**
 * Enforce Sagitine tone rules on generated response
 */
function enforceSagitineTone(response: string): string {
  let cleaned = response;

  // Remove apologies
  cleaned = cleaned.replace(/I'm sorry to hear/gi, 'Thank you for letting me know');
  cleaned = cleaned.replace(/We apologize for/gi, 'Thank you for bringing this to our attention');
  cleaned = cleaned.replace(/So sorry about/gi, 'I appreciate you sharing');
  cleaned = cleaned.replace(/sorry for any inconvenience/gi, 'Thank you for your patience');

  // Enforce terminology
  cleaned = cleaned.replace(/\bdrawer\b/gi, 'Box');
  cleaned = cleaned.replace(/\bunit\b/gi, 'Box');

  // Ensure proper greeting
  if (!cleaned.match(/^(Hi|Hello|Dear)/i)) {
    cleaned = `Hi [Customer Name],\n\n${cleaned}`;
  }

  // Ensure proper closing
  if (!cleaned.match(/(Warm regards|Kind regards),?\s*Heidi\s*x?\s*$/i)) {
    cleaned = cleaned.trimEnd() + '\n\nWarm regards,\nHeidi x';
  }

  return cleaned;
}

/**
 * Classify email using Claude 3.5 Sonnet
 */
export async function classifyEmail(payload: InboundEmailPayload): Promise<ClassificationResult> {
  // Get available knowledge counts for all categories
  const categorySummary = await Promise.all(
    Object.values(CANONICAL_CATEGORIES).map(async (category) => {
      const knowledge = await getKnowledgeByCategory(category);
      return {
        category,
        response_count: knowledge.gold_responses.length,
        snippet_count: knowledge.knowledge_snippets.length,
      };
    })
  );

  // Build user message
  const userMessage = `Classify this inbound email:

FROM: ${payload.from_name || payload.from_email} (${payload.from_email})
SUBJECT: ${payload.subject}

BODY:
${payload.body_plain}

Available knowledge base:
${categorySummary
  .filter(k => k.response_count > 0 || k.snippet_count > 0)
  .map(k => `- ${k.category}: ${k.response_count} responses, ${k.snippet_count} snippets`)
  .join('\n')}

Return strict JSON only with this structure:
{
  "category_primary": "category_id",
  "category_secondary": null,
  "confidence": 0.85,
  "urgency": 7,
  "risk_level": "low",
  "risk_flags": [],
  "customer_intent_summary": "Customer wants to know when their order will arrive",
  "recommended_next_action": "Provide delivery status and tracking information",
  "safe_to_auto_draft": true,
  "safe_to_auto_send": false,
  "retrieved_knowledge_ids": [],
  "original_subject": "${payload.subject.replace(/"/g, '\\"')}",
  "reply_subject": "",
  "reply_body": ""
}`;

  try {
    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for consistent classification
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Extract and parse JSON response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Find JSON in response (handle potential markdown code blocks)
    const jsonMatch = content.text.match(/```json\s*([\s\S]*?)\s*```/) || content.text.match(/({[\s\S]*})/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const rawResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    // Parse and validate result
    let result = parseClassificationResult(rawResult);

    // CONFIDENCE THRESHOLD: If confidence < 0.5, route to other_uncategorized
    if (result.confidence < 0.5) {
      result.category_primary = CANONICAL_CATEGORIES.OTHER_UNCATEGORIZED;
      result.risk_flags.push('low_confidence_override');
      result.customer_intent_summary = 'Unable to confidently classify - requires human review';
    }

    // Use category urgency defaults if Claude didn't provide valid urgency
    if (!result.urgency || result.urgency < 1 || result.urgency > 10) {
      result.urgency = CATEGORY_URGENCY_DEFAULTS[result.category_primary];
    }

    // Retrieve relevant knowledge
    const knowledge = await getKnowledgeByCategory(result.category_primary);

    // If Claude didn't generate a response, use the gold response template
    if (!result.reply_body && knowledge.gold_responses.length > 0) {
      const template = knowledge.gold_responses[0];
      result.reply_body = template.body_template;
    }

    // Enforce Sagitine tone on response
    if (result.reply_body) {
      result.reply_body = enforceSagitineTone(result.reply_body);
    }

    // Add retrieved knowledge IDs
    result.retrieved_knowledge_ids = [
      ...knowledge.gold_responses.map(r => r.id),
      ...knowledge.knowledge_snippets.map(s => s.id),
    ];

    // Auto-send safety: never auto-send high-risk or low-confidence
    if (result.risk_level === 'high' || result.confidence < 0.85) {
      result.safe_to_auto_send = false;
    }

    return result;
  } catch (error) {
    console.error('Claude classification error:', error);

    // Fallback: return review_required result
    return {
      category_primary: CANONICAL_CATEGORIES.BRAND_FEEDBACK_GENERAL,
      confidence: 0.1,
      urgency: 3,
      risk_level: 'medium',
      risk_flags: ['claude_api_error', 'classification_failed'],
      customer_intent_summary: 'Classification failed - requires human review',
      recommended_next_action: 'Review email manually and classify',
      safe_to_auto_draft: false,
      safe_to_auto_send: false,
      retrieved_knowledge_ids: [],
      reply_subject: `Re: ${payload.subject}`,
      reply_body: `Hi [Customer Name],\n\nThank you for your message.\n\nI'll review your inquiry and get back to you shortly.\n\nWarm regards,\nHeidi x`,
    };
  }
}

/**
 * Batch classify multiple emails
 */
export async function classifyBatch(payloads: InboundEmailPayload[]): Promise<ClassificationResult[]> {
  // Process in parallel with concurrency limit
  const concurrency = 5;
  const results: ClassificationResult[] = [];

  for (let i = 0; i < payloads.length; i += concurrency) {
    const batch = payloads.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(classifyEmail));
    results.push(...batchResults);
  }

  return results;
}
