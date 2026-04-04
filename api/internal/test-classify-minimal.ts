// @ts-nocheck
// Minimal test of classify logic - bare bones
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // Minimal validation
    if (!body.message_id || !body.subject || !body.from_email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        timestamp: new Date().toISOString(),
      });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Test 1: Can we insert to inbound_emails?
    const [insertResult] = await sql`
      INSERT INTO inbound_emails
        (source_message_id, source_thread_id, from_email, from_name, subject, body_plain, received_at)
      VALUES (
        ${body.message_id},
        ${body.thread_id || body.message_id},
        ${body.from_email},
        ${body.from_name || null},
        ${body.subject},
        ${body.body_plain || ''},
        ${new Date(body.timestamp || Date.now())}
      )
      ON CONFLICT (source_message_id) DO NOTHING
      RETURNING id, source_message_id
    `;

    if (!insertResult) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'Email already exists',
        timestamp: new Date().toISOString(),
      });
    }

    // Test 2: Can we insert to triage_results?
    const [triageResult] = await sql`
      INSERT INTO triage_results
        (email_id, category_primary, confidence, urgency, risk_level,
         customer_intent_summary, recommended_next_action, safe_to_auto_draft,
         safe_to_auto_send, reply_subject, reply_body, is_mock)
      VALUES (
        ${insertResult.id},
        'brand_feedback_general',
        0.5,
        5,
        'low',
        'Test intent',
        'Test action',
        true,
        true,
        'Re: Test',
        'Test reply body',
        true
      )
      RETURNING id, category_primary
    `;

    // Test 3: Can we insert to tickets?
    const [ticket] = await sql`
      INSERT INTO tickets (email_id, triage_result_id, status, send_status)
      VALUES (${insertResult.id}, ${triageResult.id}, 'classified', 'not_applicable')
      RETURNING id, status
    `;

    return res.status(200).json({
      success: true,
      email_id: insertResult.id,
      triage_result_id: triageResult.id,
      ticket_id: ticket.id,
      message: 'Minimal test successful',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
}
