// Test endpoint for new classification system
import type { InboundEmailPayload } from '../src/api/types.js';
import { classifyEmail } from './internal/services/classification-engine.js';
import { generateDraft } from './internal/services/template-lookup.js';

export default async function handler(req: any, res: any) {
  // CORS headers
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
    const { subject, body_plain, from_name } = req.body;

    if (!subject || !body_plain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: subject, body_plain',
        timestamp: new Date().toISOString(),
      });
    }

    // Run classification
    const classification = classifyEmail(
      subject,
      body_plain,
      from_name || 'Customer'
    );

    // Generate draft if safe_to_auto_draft
    let replyBody: string | null = null;
    if (classification.safe_to_auto_draft) {
      replyBody = generateDraft(
        classification.category_primary,
        from_name || 'Customer'
      );
    }

    // Return results
    return res.status(200).json({
      success: true,
      classification: {
        category: classification.category_primary,
        confidence: classification.confidence,
        urgency: classification.urgency,
        risk_level: classification.risk_level,
        customer_intent_summary: classification.customer_intent_summary,
        recommended_next_action: classification.recommended_next_action,
        safe_to_auto_draft: classification.safe_to_auto_draft,
        safe_to_auto_send: classification.safe_to_auto_send,
        matched_scenario_id: classification.matched_scenario_id,
        matched_scenario_label: classification.matched_scenario_label,
        match_score: classification.match_score,
      },
      draft: {
        reply_subject: `Re: ${subject}`,
        reply_body: replyBody,
      },
      timestamp: new Date().toISOString(),
      _mode: 'gold_response_system',
    });

  } catch (error: any) {
    console.error('Classification test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
