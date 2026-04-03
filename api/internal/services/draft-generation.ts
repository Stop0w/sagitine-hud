/**
 * Draft Generation Service
 *
 * Generates customer-facing draft responses from response strategy.
 *
 * Controlled Haiku usage:
 * - Receives explicit strategy object (action, constraints, template)
 * - Uses selected template as base
 * - Personalises for customer context
 * - Enforces mustInclude/mustAvoid constraints
 * - Enforces Sagitine TOV rules
 * - Never invents policy or promises
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ResponseStrategy, StrategyContext } from './response-strategy.js';
import { applySagitoneTOVCleanup, generateTOVPrompt, SAGITINE_SIGN_OFF } from '../config/sagitine-tov.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// DRAFT GENERATION FROM STRATEGY
// ============================================================================

/**
 * Generate draft response from strategy + context.
 *
 * Strategy drives the draft. Haiku only personalises and enforces tone.
 */
export async function generateDraftFromStrategy(
  strategy: ResponseStrategy,
  ctx: StrategyContext
): Promise<string> {
  const { customer, email } = ctx;
  const customerName = customer.name || customer.email.split('@')[0];

  // Build TOV-aware prompt
  const prompt = generateTOVPrompt(
    strategy,
    customerName,
    customer.email,
    email.subject,
    email.bodyPlain
  );

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      temperature: 0.4, // Slightly higher for personalisation
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      let draft = content.text.trim();

      // Apply deterministic TOV cleanup (BEFORE and AFTER Haiku)
      draft = applySagitoneTOVCleanup(draft);

      return draft;
    }
  } catch (error) {
    console.error('Draft generation error:', error);
  }

  // Fallback: Use template directly with TOV cleanup
  if (strategy.templateBody) {
    let draft = personaliseTemplate(strategy.templateBody, customerName);
    draft = applySagitoneTOVCleanup(draft);
    return draft;
  }

  // Ultimate fallback with TOV compliance
  let fallback = `Hi ${customerName},\n\nThank you for reaching out.\n\nI'll review your enquiry and get back to you shortly.\n\nWarm regards,\nHeidi x`;
  return applySagitoneTOVCleanup(fallback);
}

// ============================================================================
// TEMPLATE PERSONALISATION (Deterministic)
// ============================================================================

/**
 * Personalise template with customer name.
 */
function personaliseTemplate(template: string, customerName: string): string {
  let personalised = template;

  // Replace placeholders
  personalised = personalised.replace(/\[Customer Name\]/gi, customerName);
  personalised = personalised.replace(/\{customer_name\}/gi, customerName);
  personalised = personalised.replace(/\[name\]/gi, customerName);

  return personalised;
}

// ============================================================================
// DRAFT SUMMARY (Optional Haiku)
// ============================================================================

/**
 * Generate brief summary of what draft does.
 * Used for UI preview: "This response [action] and [outcome]."
 */
export async function generateDraftSummary(strategy: ResponseStrategy): Promise<string> {
  const prompt = `Summarise this response strategy in one short sentence (max 15 words).

Action: ${strategy.recommendedAction}

Return the summary only, no preamble. Example:
"Offers replacement for damaged item and requests photo evidence."`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 50,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }
  } catch (error) {
    console.error('Draft summary generation error:', error);
  }

  // Fallback: Use action type
  return strategy.recommendedAction.split('.')[0] + '.';
}
