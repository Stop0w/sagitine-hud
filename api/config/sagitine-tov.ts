/**
 * Sagitine Tone of Voice Enforcement Layer
 *
 * Centralized TOV rules for draft generation and proofing.
 * Ensures all customer communications are:
 * - On brand
 * - Policy-safe
 * - Terminologically correct
 * - Consistent with Sagitine's luxury customer service voice
 */

// ============================================================================
// TOV CONSTANTS
// ============================================================================

export const SAGITINE_TOV = {
  // Core tone descriptors
  coreTone: {
    calm: true,
    warm: true,
    polished: true,
    helpful: true,
    quietlyPremium: true,
    clear: true,
    neverGushy: true,
    neverCorporate: true,
  },

  // Preferred phrasing (use these where natural)
  preferredPhrasing: [
    'Thank you for reaching out',
    'Thank you for letting me know',
    'I can arrange',
    'I can organise',
    'Just let me know what works best',
    'Warm regards, Heidi x',
  ],

  // Mandatory terminology
  terminology: {
    prefer: ['Box', 'Boxes'],
    avoid: ['drawer', 'drawers', 'item', 'unit', 'product'],
  },

  // Prohibited words and phrases
  prohibited: [
    // Apologies
    "I'm sorry",
    'We apologise',
    'I apologize',
    'So sorry',
    'sorry for any inconvenience',
    'Unfortunately',

    // Casual/salesy
    'No worries',
    'Awesome',
    'Super',
    'Hey',
    'Cheers',
    'No problem',

    // Over-explaining
    'To be honest',
    'Basically',
    'Long story short',

    // Risky promises
    'I promise',
    'Guaranteed',
    '100%',
    'Always',
  ],

  // Required sign-off
  signOff: 'Warm regards,\nHeidi x',

  // Structural preferences
  structure: {
    shortParagraphs: true,
    directNextStep: true,
    ownershipLanguage: true,
    conciseExplanation: true,
    elegantSignOff: true,
  },
} as const;

// ============================================================================
// DETERMINISTIC CLEANUP RULES
// ============================================================================

/**
 * Apply deterministic TOV cleanup rules.
 * These run BEFORE and AFTER Haiku generation to catch obvious violations.
 */
export function applySagitineTOVCleanup(text: string): string {
  let cleaned = text;

  // 1. Terminology enforcement (drawer → Box)
  cleaned = cleaned.replaceAll(/\bdrawers?\b/g, 'Box');
  cleaned = cleaned.replaceAll(/\bunit\b/g, 'Box');
  cleaned = cleaned.replace(/\bitem(s)?\b/g, 'Box'); // Context-dependent, use carefully

  // 2. Remove prohibited phrases
  cleaned = cleaned.replace(/I'm sorry to hear/gi, 'Thank you for letting me know');
  cleaned = cleaned.replace(/We apologise for/gi, 'Thank you for bringing this to our attention');
  cleaned = cleaned.replace(/So sorry about/gi, 'I appreciate you sharing');
  cleaned = cleaned.replace(/sorry for any inconvenience/gi, 'Thank you for your patience');
  cleaned = cleaned.replace(/I apologize/gi, 'Thank you');
  cleaned = cleaned.replace(/We apologize/gi, 'We appreciate');
  cleaned = cleaned.replace(/Unfortunately[,;\s]+/gi, ', ');

  // 3. Remove casual language
  cleaned = cleaned.replace(/No worries[,;\s]*[.!]?/gi, '.');
  cleaned = cleaned.replace(/That's awesome/gi, 'That\'s great');
  cleaned = cleaned.replace(/Super[,;\s]+/gi, 'Very ');
  cleaned = cleaned.replace(/Hey[,;\s]+\w+/gi, 'Hi');

  // 4. Fix malformed sign-offs
  cleaned = cleaned.replace(/Regards[,\s]*/gi, 'Warm regards, ');
  cleaned = cleaned.replace(/Best regards[,\s]*/gi, 'Warm regards, ');
  cleaned = cleaned.replace(/Kind regards[,\s]*/gi, 'Warm regards, ');

  // Ensure proper sign-off format
  if (!cleaned.match(/Warm regards,\s*Heidi x/i)) {
    // Remove any existing sign-off attempt
    cleaned = cleaned.replace(/Regards[^\n]+/gi, '');
    cleaned = cleaned.replace(/Best[^\n]+/gi, '');

    // Add proper sign-off
    cleaned = cleaned.trimEnd() + '\n\nWarm regards,\nHeidi x';
  }

  return cleaned;
}

// ============================================================================
// PROOFING RUBRIC GENERATION
// ============================================================================

/**
 * Generate TOV-aware proofing checklist.
 * Expands standard proofing to include brand compliance checks.
 */
export function generateTOVProofingChecklist(): string {
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

// ============================================================================
// BRAND COMPLIANCE ASSESSMENT
// ============================================================================

/**
 * Assess brand compliance from proofing result.
 * Returns pass/fail status based on TOV violations found.
 */
export function assessBrandCompliance(suggestions: any[]): 'pass' | 'fixes_applied' | 'warning' {
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

  if (highSeverity > 0) {
    return 'warning';
  } else if (mediumSeverity > 0 || tovSuggestions.length > 0) {
    return 'fixes_applied';
  } else {
    return 'pass';
  }
}

// ============================================================================
// DRAFT GENERATION PROMPT ENHANCEMENT
// ============================================================================

/**
 * Generate TOV-aware prompt for draft generation.
 * Adds Sagitine TOV requirements to the strategy-driven prompt.
 */
export function generateTOVPrompt(
  strategy: any,
  customerName: string,
  customerEmail: string,
  emailSubject: string,
  emailBody: string
): string {
  return `Generate a customer service email response using this strategy:

STRATEGY:
- Action: ${strategy.recommendedAction}
- Tone: ${strategy.draftTone}
- Template Confidence: ${strategy.matchedTemplateConfidence}%

MUST INCLUDE:
${strategy.mustInclude.map((item: string) => `- ${item}`).join('\n')}

MUST AVOID:
${strategy.mustAvoid.map((item: string) => `- ${item}`).join('\n')}

CUSTOMER CONTEXT:
- Name: ${customerName}
- Email: ${customerEmail}
- Repeat Customer: ${strategy.customerContext?.isRepeatContact ? 'Yes' : 'No'}
- High Attention: ${strategy.customerContext?.isHighAttentionCustomer ? 'Yes' : 'No'}
- Total Contacts: ${strategy.customerContext?.totalContactCount || 0}

ENQUIRY:
Subject: ${emailSubject}
Message: ${emailBody.substring(0, 500)}

${strategy.templateBody ? `REFERENCE TEMPLATE (adapt this, don't copy exactly):\n${strategy.templateBody}\n` : ''}

SAGITINE TONE OF VOICE REQUIREMENTS:
- Core tone: Calm, warm, polished, helpful, quietly premium, clear, never gushy, never corporate
- Preferred phrasing: "Thank you for reaching out", "Thank you for letting me know", "I can arrange", "I can organise", "Just let me know what works best"
- Terminology: Always use "Box/Boxes", never use "drawer/drawers" or generic "unit/item/product"
- Avoid: "I'm sorry", "We apologise", "Unfortunately", "No worries", "Awesome", "Super", "Hey"
- Structure: Short paragraphs, direct next step, ownership language, concise explanation, elegant sign-off

REQUIREMENTS:
1. Adapt the template for this specific customer (${customerName})
2. Include all MUST_INCLUDE elements naturally
3. Avoid all MUST_AVOID elements strictly
4. Use preferred Sagitine phrasing where natural
5. Sign off as "Warm regards, Heidi x" (elegant and consistent)
6. No apologies - use "Thank you for reaching out" or "Thank you for letting me know" instead
7. Keep concise and professional
8. Do NOT invent refunds, promises, or policies not already in the template
9. Maintain luxury CX tone: warm and premium, not robotic or sterile

Return the email body only (no subject, no preamble, no JSON).`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SAGITINE_SIGN_OFF = 'Warm regards,\nHeidi x';
export const DEFAULT_GREETING = 'Hi';
