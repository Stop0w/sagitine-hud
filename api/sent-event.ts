// POST /api/sent-event
// Called by Make.com when a reply is sent from Outlook (Approval & Send scenario)
//
// Accepts the raw send event from Make.com and:
// 1. Stores the event immediately (never fails on a lookup miss)
// 2. Best-effort matches to an inbound ticket via conversation_id
// 3. If matched: updates ticket send_status, customer profile, and contact fact ledger
// 4. If not matched: stores event unlinked — data is never lost
//
// Body: { conversation_id, message_id, sent_at, sent_by, subject, to_email }

import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

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
    const body = req.body;

    const {
      conversation_id,
      message_id,
      sent_at,
      sent_by,
      subject,
      to_email,
    } = body;

    // Validate minimum required fields
    if (!conversation_id || !sent_at) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: conversation_id, sent_at',
        timestamp: new Date().toISOString(),
      });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Parse sent_at — accept both ISO strings and Make.com native date formats
    const sentAtDate = new Date(sent_at);
    if (isNaN(sentAtDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: `Invalid sent_at date format: "${sent_at}"`,
        timestamp: new Date().toISOString(),
      });
    }

    // ============================================================================
    // STEP 1 — ENSURE sent_events TABLE EXISTS (self-bootstrapping)
    // ============================================================================
    await sql`
      CREATE TABLE IF NOT EXISTS sent_events (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        message_id TEXT UNIQUE,
        ticket_id UUID,
        sent_at TIMESTAMPTZ NOT NULL,
        sent_by TEXT,
        subject TEXT,
        to_email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // ============================================================================
    // STEP 2 — STORE RAW SEND EVENT (always succeeds regardless of ticket match)
    // ============================================================================
    await sql`
      INSERT INTO sent_events (
        conversation_id, message_id, sent_at, sent_by, subject, to_email, created_at
      ) VALUES (
        ${conversation_id},
        ${message_id || null},
        ${sentAtDate.toISOString()},
        ${sent_by || 'Sagitine'},
        ${subject || null},
        ${to_email || null},
        NOW()
      )
      ON CONFLICT (message_id) DO NOTHING
    `;

    // ============================================================================
    // STEP 3 — BEST-EFFORT TICKET MATCH via conversation_id → source_thread_id
    // ============================================================================
    const ticketMatch = await sql`
      SELECT
        t.id as ticket_id,
        ie.from_email,
        ie.from_name
      FROM tickets t
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      WHERE ie.source_thread_id = ${conversation_id}
      ORDER BY t.created_at DESC
      LIMIT 1
    `;

    if (ticketMatch.length === 0) {
      // No matching ticket — send event is stored, return success
      console.log(`sent-event: no ticket match for conversation_id ${conversation_id} — event stored unlinked`);
      return res.status(200).json({
        success: true,
        matched: false,
        message: 'Send event recorded. No matching inbound ticket found — stored unlinked.',
        timestamp: new Date().toISOString(),
      });
    }

    const { ticket_id, from_email, from_name } = ticketMatch[0];

    // ============================================================================
    // STEP 4 — UPDATE TICKET STATUS
    // ============================================================================
    await sql`
      UPDATE tickets
      SET send_status = 'sent',
          sent_at = ${sentAtDate.toISOString()},
          status = 'approved'
      WHERE id = ${ticket_id}
    `;

    // ============================================================================
    // STEP 5 — UPDATE CUSTOMER PROFILE (upsert contact stats)
    // ============================================================================
    const profileResult = await sql`
      SELECT id, total_contact_count
      FROM customer_profiles
      WHERE email = ${from_email.toLowerCase()}
      LIMIT 1
    `;

    let profileId: string | null = null;

    if (profileResult.length > 0) {
      profileId = profileResult[0].id;
      const newCount = (parseInt(profileResult[0].total_contact_count) || 0) + 1;

      await sql`
        UPDATE customer_profiles
        SET last_contact_at = ${sentAtDate.toISOString()},
            last_contact_channel = 'email',
            total_contact_count = ${newCount},
            is_repeat_contact = true
        WHERE id = ${profileId}
      `;
    }

    // ============================================================================
    // STEP 6 — APPEND TO CONTACT FACT LEDGER (outbound record)
    // ============================================================================
    if (profileId) {
      await sql`
        INSERT INTO customer_contact_facts (
          customer_profile_id, ticket_id, channel, direction, contact_at
        ) VALUES (
          ${profileId}, ${ticket_id}, 'email', 'outbound', ${sentAtDate.toISOString()}
        )
      `;
    }

    // ============================================================================
    // STEP 7 — LINK SEND EVENT TO TICKET
    // ============================================================================
    await sql`
      UPDATE sent_events
      SET ticket_id = ${ticket_id}
      WHERE conversation_id = ${conversation_id}
        AND ticket_id IS NULL
    `;

    return res.status(200).json({
      success: true,
      matched: true,
      ticket_id,
      message: 'Send event recorded, ticket updated, CRM profile updated.',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('sent-event error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
