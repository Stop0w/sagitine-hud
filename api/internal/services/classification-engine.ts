/**
 * Classification Engine Service
 *
 * Loads training data from gold_classification_training.json
 * and matches customer emails to categories using pattern matching.
 *
 * Pattern matching approach: Keyword/phrase similarity with confidence scoring
 * Future upgrade: Semantic similarity using embeddings
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface TrainingScenario {
  id: string;
  title: string;
  category: string;
  customer_question: string;
  scenario_label: string;
  body_template: string;
  tone_notes: string;
  quality_score: number;
  is_active?: boolean;
  synthesized?: boolean;
  source: string;
}

interface ClassificationResult {
  category_primary: string;
  confidence: number;
  urgency: number;
  risk_level: 'low' | 'medium' | 'high';
  customer_intent_summary: string;
  recommended_next_action: string;
  safe_to_auto_draft: boolean;
  safe_to_auto_send: boolean;
  matched_scenario_id: string | null;
  matched_scenario_label: string | null;
  match_score: number;
}

interface CategoryMetadata {
  urgency: 'low' | 'medium' | 'high';
  safe_to_auto_draft: boolean;
  safe_to_auto_send: boolean;
  risk_level: 'low' | 'medium' | 'high';
}

// ============================================================================
// CATEGORY METADATA (from gold_master_index.json)
// ============================================================================

const CATEGORY_METADATA: Record<string, CategoryMetadata> = {
  damaged_missing_faulty: {
    urgency: 'high',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'high',
  },
  shipping_delivery_order_issue: {
    urgency: 'high',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'medium',
  },
  return_refund_exchange: {
    urgency: 'high',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'medium',
  },
  order_modification_cancellation: {
    urgency: 'high',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'medium',
  },
  product_usage_guidance: {
    urgency: 'medium',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'low',
  },
  pre_purchase_question: {
    urgency: 'medium',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'low',
  },
  stock_availability: {
    urgency: 'low',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'low',
  },
  partnership_wholesale_press: {
    urgency: 'low',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'low',
  },
  brand_feedback_general: {
    urgency: 'low',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    risk_level: 'low',
  },
  praise_testimonial_ugc: {
    urgency: 'low',
    safe_to_auto_draft: true,
    safe_to_auto_send: true,
    risk_level: 'low',
  },
  spam_solicitation: {
    urgency: 'none',
    safe_to_auto_draft: false,
    safe_to_auto_send: false,
    risk_level: 'low',
  },
  other_uncategorized: {
    urgency: 'medium',
    safe_to_auto_draft: false,
    safe_to_auto_send: false,
    risk_level: 'medium',
  },
};

// ============================================================================
// TRAINING DATA CACHE
// ============================================================================

let trainingData: TrainingScenario[] | null = null;

function loadTrainingData(): TrainingScenario[] {
  if (trainingData) {
    return trainingData;
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'knowledge', 'gold_classification_training.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    trainingData = JSON.parse(fileContent);

    console.log(`✓ Classification engine loaded ${trainingData.length} training scenarios from gold_classification_training.json`);
    return trainingData;
  } catch (error) {
    console.error('Failed to load training data:', error);
    return [];
  }
}

// ============================================================================
// SPAM DETECTION (Highest priority)
// ============================================================================

function detectSpam(subject: string, body: string): ClassificationResult | null {
  const text = `${subject} ${body}`.toLowerCase();

  // Legitimate partnership phrases that should NOT trigger spam detection
  const legitimatePartnershipPhrases = [
    'gift hamper',
    'gift hampers',
    'press enquiry',
    'editorial feature',
    'corporate gifting',
    'wholesale pricing',
    'trade pricing',
    'interior designer',
    'stocking your products',
  ];

  // If contains legitimate partnership phrases, don't classify as spam
  const hasLegitimatePartnershipPhrase = legitimatePartnershipPhrases.some(phrase => text.includes(phrase));
  if (hasLegitimatePartnershipPhrase) {
    return null; // Let it fall through to normal classification
  }

  const spamPatterns = [
    'collaboration',
    'revenue guaranteed',
    '10x revenue',
    'jump on a call',
    'outreach guaranteed',
    'scale to 7 figures',
    'book a quick call',
    '300% increase',
    'help ecommerce brands',
    'guaranteed results',
    'build websites for',
    'losing traffic',
    'seo audit',
  ];

  const hasSpamPattern = spamPatterns.some(pattern => text.includes(pattern));

  if (hasSpamPattern) {
    return {
      category_primary: 'spam_solicitation',
      confidence: 0.95,
      urgency: 1,
      risk_level: 'low',
      customer_intent_summary: 'Spam/cold outreach solicitation',
      recommended_next_action: 'Ignore or mark as spam',
      safe_to_auto_draft: false,
      safe_to_auto_send: false,
      matched_scenario_id: null,
      matched_scenario_label: null,
      match_score: 0,
    };
  }

  return null;
}

// ============================================================================
// PATTERN MATCHING ENGINE
// ============================================================================

function calculateMatchScore(
  customerQuestion: string | undefined,
  emailSubject: string,
  emailBody: string
): number {
  const searchText = `${emailSubject} ${emailBody}`.toLowerCase();

  // Handle entries without customer_question (from classify.json)
  // These entries are response templates, not training patterns, so skip them
  if (!customerQuestion) {
    return 0;
  }

  const pattern = customerQuestion.toLowerCase();

  // Exact phrase match
  if (searchText.includes(pattern)) {
    return 1.0;
  }

  // Word-level matching
  const patternWords = pattern.split(/\s+/).filter(w => w.length > 3);
  const matchedWords = patternWords.filter(word => searchText.includes(word));

  if (patternWords.length === 0) {
    return 0;
  }

  const wordMatchRatio = matchedWords.length / patternWords.length;

  // Boost score for longer phrases (more specific)
  const phraseLengthBoost = Math.min(patternWords.length * 0.05, 0.2);

  return Math.min(wordMatchRatio + phraseLengthBoost, 1.0);
}

function classifyEmail(
  subject: string,
  body: string,
  fromName: string
): ClassificationResult {
  const searchText = `${subject} ${body}`.toLowerCase();

  // Priority 1: Spam detection
  const spamResult = detectSpam(subject, body);
  if (spamResult) {
    return spamResult;
  }

  // Priority 1.5: Hard override rules for high-risk scenarios
  // These fire unconditionally regardless of classifier output

  // Account/Billing hard overrides (highest trust-risk scenarios)
  if (searchText.includes('charged twice') ||
      searchText.includes('charged but no order') ||
      searchText.includes('payment taken') ||
      searchText.includes('debited') ||
      searchText.includes('money taken') ||
      searchText.includes('double charge')) {
    return {
      category_primary: 'account_billing_payment',
      confidence: 1.0,
      urgency: 10,
      risk_level: 'high',
      customer_intent_summary: 'Payment dispute - money taken without order confirmation',
      recommended_next_action: 'URGENT: Manual review required - investigate payment discrepancy',
      safe_to_auto_draft: false,
      safe_to_auto_send: false,
      matched_scenario_id: null,
      matched_scenario_label: null,
      match_score: 1.0,
    };
  }

  if (searchText.includes("can't log in") ||
      searchText.includes('cannot log in') ||
      searchText.includes('password reset') ||
      searchText.includes('not receiving email') ||
      searchText.includes('account access')) {
    return {
      category_primary: 'account_billing_payment',
      confidence: 1.0,
      urgency: 8,
      risk_level: 'medium',
      customer_intent_summary: 'Account access or login issue',
      recommended_next_action: 'Assist with account access or password reset',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      matched_scenario_id: null,
      matched_scenario_label: null,
      match_score: 1.0,
    };
  }

  // Shipping delivery hard overrides - specific keywords route to shipping
  if (searchText.includes('parcel') ||
      searchText.includes('tracking') ||
      searchText.includes('delivered to wrong') ||
      searchText.includes('delivered to the wrong') ||
      searchText.includes('wrong address') && searchText.includes('delivered')) {
    return {
      category_primary: 'shipping_delivery_order_issue',
      confidence: 1.0,
      urgency: 9,
      risk_level: 'high',
      customer_intent_summary: 'Shipping delivery enquiry with tracking/location keywords',
      recommended_next_action: 'Check tracking status and provide delivery update',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      matched_scenario_id: null,
      matched_scenario_label: null,
      match_score: 1.0,
    };
  }

  // Shipping delivery hard override - delivery disputes
  if (searchText.includes('delivered but not received') ||
      searchText.includes('says delivered') ||
      searchText.includes('tracking shows delivered')) {
    return {
      category_primary: 'shipping_delivery_order_issue',
      confidence: 1.0,
      urgency: 9,
      risk_level: 'high',
      customer_intent_summary: 'Delivery status discrepancy - tracking shows delivered but not received',
      recommended_next_action: 'Investigate delivery status and courier GPS coordinates',
      safe_to_auto_draft: true,
      safe_to_auto_send: false,
      matched_scenario_id: null,
      matched_scenario_label: null,
      match_score: 1.0,
    };
  }

  // Priority 2: Pattern matching against training data
  const scenarios = loadTrainingData();
  const matches: Array<{
    scenario: TrainingScenario;
    score: number;
  }> = [];

  for (const scenario of scenarios) {
    // Skip inactive scenarios (negative examples)
    if (scenario.is_active === false) {
      continue;
    }

    const score = calculateMatchScore(scenario.customer_question, subject, body);

    if (score > 0.4) { // Minimum threshold for consideration
      matches.push({ scenario, score });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  if (matches.length > 0 && matches[0].score >= 0.7) {
    const bestMatch = matches[0];

    // Check for praise_testimonial_ugc signals that should override brand_feedback_general
    const praiseSignals = ['gifted', 'sister', 'brother', 'husband', 'wife', 'partner', 'birthday', 'instagram', 'featured', 'review', 'social media', 'tagged', 'followers'];
    const hasPraiseSignal = praiseSignals.some(signal => searchText.includes(signal));

    // Specificity check for brand_feedback_general to prevent over-matching
    if (bestMatch.scenario.category === 'brand_feedback_general') {
      // If has praise_testimonial_ugc signals, look for a praise_testimonial_ugc match instead
      if (hasPraiseSignal) {
        const praiseMatch = matches.find(m => m.scenario.category === 'praise_testimonial_ugc' && m.score >= 0.7);
        if (praiseMatch) {
          // Use praise_testimonial_ugc match instead of brand_feedback_general
          const metadata = CATEGORY_METADATA[praiseMatch.scenario.category] || CATEGORY_METADATA.other_uncategorized;
          return {
            category_primary: praiseMatch.scenario.category,
            confidence: praiseMatch.score,
            urgency: metadata.urgency === 'high' ? 10 : metadata.urgency === 'medium' ? 6 : 3,
            risk_level: metadata.risk_level,
            customer_intent_summary: praiseMatch.scenario.scenario_label,
            recommended_next_action: generateRecommendedAction(praiseMatch.scenario.category),
            safe_to_auto_draft: metadata.safe_to_auto_draft,
            safe_to_auto_send: metadata.safe_to_auto_send,
            matched_scenario_id: praiseMatch.scenario.id,
            matched_scenario_label: praiseMatch.scenario.scenario_label,
            match_score: praiseMatch.score,
          };
        }
      }

      // Require 90% confidence minimum for brand_feedback_general
      if (bestMatch.score < 0.9) {
        // Below 90% confidence → route to other_uncategorized instead
        return {
          category_primary: 'other_uncategorized',
          confidence: bestMatch.score,
          urgency: 5,
          risk_level: 'medium',
          customer_intent_summary: 'Insufficient specificity for brand feedback',
          recommended_next_action: 'Review and respond appropriately',
          safe_to_auto_draft: false,
          safe_to_auto_send: false,
          matched_scenario_id: null,
          matched_scenario_label: null,
          match_score: bestMatch.score,
        };
      }

      // Additional specificity checks for brand_feedback_general at 90%+ confidence
      const hasQuestionMark = searchText.includes('?');
      const hasOrderWords = searchText.includes('order') || searchText.includes('#') ||
                           searchText.match(/\d{6,}/); // Order number pattern
      const hasActionWords = searchText.includes('can you') || searchText.includes('please') ||
                            searchText.includes('would like') || searchText.includes('need') ||
                            searchText.includes('change') || searchText.includes('help') ||
                            searchText.includes('fix') || searchText.includes('correct');

      // If brand_feedback_general but contains questions, orders, or action requests → not pure feedback
      if (hasQuestionMark || hasOrderWords || hasActionWords) {
        return {
          category_primary: 'other_uncategorized',
          confidence: bestMatch.score,
          urgency: 5,
          risk_level: 'medium',
          customer_intent_summary: 'Brand feedback matched but contains request/action - requires human review',
          recommended_next_action: 'Review and respond appropriately',
          safe_to_auto_draft: false,
          safe_to_auto_send: false,
          matched_scenario_id: null,
          matched_scenario_label: null,
          match_score: bestMatch.score,
        };
      }
    }

    // Found a high-confidence match (raised from 0.6 to 0.7)
    const metadata = CATEGORY_METADATA[bestMatch.scenario.category] || CATEGORY_METADATA.other_uncategorized;

    return {
      category_primary: bestMatch.scenario.category,
      confidence: bestMatch.score,
      urgency: metadata.urgency === 'high' ? 10 : metadata.urgency === 'medium' ? 6 : 3,
      risk_level: metadata.risk_level,
      customer_intent_summary: bestMatch.scenario.scenario_label,
      recommended_next_action: generateRecommendedAction(bestMatch.scenario.category),
      safe_to_auto_draft: metadata.safe_to_auto_draft,
      safe_to_auto_send: metadata.safe_to_auto_send,
      matched_scenario_id: bestMatch.scenario.id,
      matched_scenario_label: bestMatch.scenario.scenario_label,
      match_score: bestMatch.score,
    };
  }

  // Priority 3: Low confidence or no match → other_uncategorized (changed from brand_feedback_general)
  return {
    category_primary: 'other_uncategorized',
    confidence: matches.length > 0 ? matches[0].score : 0.5,
    urgency: 5,
    risk_level: 'medium',
    customer_intent_summary: matches.length > 0 ? 'Unclear customer request' : 'No clear customer intent',
    recommended_next_action: 'Request clarification from customer',
    safe_to_auto_draft: false, // Changed from true - requires human review
    safe_to_auto_send: false,
    matched_scenario_id: null,
    matched_scenario_label: null,
    match_score: matches.length > 0 ? matches[0].score : 0,
  };
}

function generateRecommendedAction(category: string): string {
  const actions: Record<string, string> = {
    damaged_missing_faulty: 'Request photo evidence and arrange replacement',
    shipping_delivery_order_issue: 'Check order status and provide update',
    product_usage_guidance: 'Provide usage instructions and guidance',
    pre_purchase_question: 'Answer product questions to support purchase decision',
    return_refund_exchange: 'Process return request according to policy',
    stock_availability: 'Check stock levels and provide availability information',
    partnership_wholesale_press: 'Forward to appropriate team for review',
    brand_feedback_general: 'Review and respond appropriately',
    order_modification_cancellation: 'Check order status and assist with changes',
  };

  return actions[category] || 'Review and respond appropriately';
}

// ============================================================================
// EXPORTS
// ============================================================================

export { classifyEmail, loadTrainingData };
export type { ClassificationResult, TrainingScenario };
