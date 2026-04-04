// @ts-nocheck
// Tickets API endpoints for Sagitine AI CX Agent - Using raw SQL
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

// ============================================================================
// GET /api/tickets - List all tickets for HUD queue
// ============================================================================

async function getTickets(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const status = url.searchParams.get('status');
    const urgencyGte = url.searchParams.get('urgencygte');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const sql = neon(process.env.DATABASE_URL);

    let results;
    if (status) {
      results = await sql`
        SELECT
          t.id as ticket_id,
          t.status,
          t.send_status as sendStatus,
          ie.from_email as fromEmail,
          ie.from_name as fromName,
          ie.subject,
          tr.category_primary as categoryPrimary,
          tr.confidence::text as confidence,
          tr.urgency,
          tr.risk_level as riskLevel,
          tr.customer_intent_summary as customerIntentSummary,
          tr.reply_subject as replySubject,
          ie.received_at as receivedAt,
          t.created_at as createdAt
        FROM tickets t
        INNER JOIN inbound_emails ie ON t.email_id = ie.id
        INNER JOIN triage_results tr ON t.triage_result_id = tr.id
        WHERE t.archived_at IS NULL AND t.status = ${status}
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      results = await sql`
        SELECT
          t.id as ticket_id,
          t.status,
          t.send_status as sendStatus,
          ie.from_email as fromEmail,
          ie.from_name as fromName,
          ie.subject,
          tr.category_primary as categoryPrimary,
          tr.confidence::text as confidence,
          tr.urgency,
          tr.risk_level as riskLevel,
          tr.customer_intent_summary as customerIntentSummary,
          tr.reply_subject as replySubject,
          ie.received_at as receivedAt,
          t.created_at as createdAt
        FROM tickets t
        INNER JOIN inbound_emails ie ON t.email_id = ie.id
        INNER JOIN triage_results tr ON t.triage_result_id = tr.id
        WHERE t.archived_at IS NULL
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    }

    // Filter by urgency if specified (post-filter)
    if (urgencyGte) {
      const threshold = parseInt(urgencyGte, 10);
      results = results.filter(r => r.urgency >= threshold);
    }

    return res.status(200).json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/tickets error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// GET /api/tickets/:id - Single ticket for resolution console
// ============================================================================

async function getTicket(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').pop();

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    const result = await sql`
      SELECT
        t.id as ticket_id,
        t.status,
        t.send_status as sendStatus,
        t.assigned_to as assignedTo,
        t.approved_at as approvedAt,
        t.approved_by as approvedBy,
        t.sent_at as sentAt,
        t.rejected_at as rejectedAt,
        t.rejected_by as rejectedBy,
        t.rejection_reason as rejectionReason,
        t.human_edited as humanEdited,
        t.human_edited_body as humanEditedBody,
        ie.id as email_id,
        ie.from_email as fromEmail,
        ie.from_name as fromName,
        ie.subject,
        ie.body_plain as bodyPlain,
        ie.body_html as bodyHtml,
        ie.received_at as receivedAt,
        tr.id as triage_result_id,
        tr.category_primary as categoryPrimary,
        tr.confidence::text as confidence,
        tr.urgency,
        tr.risk_level as riskLevel,
        tr.risk_flags as riskFlags,
        tr.customer_intent_summary as customerIntentSummary,
        tr.recommended_next_action as recommendedNextAction,
        tr.safe_to_auto_draft as safeToAutoDraft,
        tr.safe_to_auto_send as safeToAutoSend,
        tr.reply_subject as replySubject,
        tr.reply_body as replyBody,
        tr.retrieved_knowledge_ids as retrievedKnowledgeIds,
        tr.is_mock as isMock
      FROM tickets t
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      WHERE t.id = ${ticketId}
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: result[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/tickets/:id error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// POST /api/tickets/:id/approve - Approve ticket and trigger Make webhook
// ============================================================================

async function approveTicket(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').slice(0, -1).pop();

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const body = req.body || {};
    const approvedBy = body.approved_by || 'Heidi';
    const editedReplyBody = body.edited_reply_body;

    const sql = neon(process.env.DATABASE_URL);

    // DOUBLE-SEND PROTECTION: Check current send_status
    const [currentTicket] = await sql`
      SELECT id, send_status as sendStatus, status
      FROM tickets
      WHERE id = ${ticketId}
      LIMIT 1
    `;

    if (!currentTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    // If already pending or sent, reject to prevent double-sends
    if (currentTicket.sendstatus === 'pending' || currentTicket.sendstatus === 'sent') {
      return res.status(409).json({
        success: false,
        error: 'Ticket is already being processed or has been sent',
        current_status: currentTicket.status,
        current_send_status: currentTicket.sendstatus,
        message: 'Cannot approve - ticket already in send workflow',
        timestamp: new Date().toISOString(),
      });
    }

    // Update ticket status
    let updateQuery = `
      UPDATE tickets
      SET status = 'approved',
          send_status = 'pending',
          approved_at = NOW(),
          approved_by = ${approvedBy}
    `;

    if (editedReplyBody) {
      updateQuery += `, human_edited = true, human_edited_body = ${editedReplyBody}`;
    }

    updateQuery += ` WHERE id = ${ticketId} RETURNING id, status, send_status, approved_at, approved_by`;

    const [updated] = await sql.unsafe(updateQuery);

    // TODO: Trigger Make webhook here
    // Make will call back to /api/tickets/:id/sent on success

    return res.status(200).json({
      success: true,
      data: {
        ticket_id: updated.id,
        status: updated.status,
        send_status: updated.send_status,
        approved_at: updated.approved_at,
        approved_by: updated.approved_by,
      },
      message: 'Ticket approved and queued for sending',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('POST /api/tickets/:id/approve error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// POST /api/tickets/:id/reject - Reject ticket
// ============================================================================

async function rejectTicket(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').slice(0, -1).pop();

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const body = req.body || {};
    const rejectedBy = body.rejected_by || 'Heidi';
    const rejectionReason = body.rejection_reason;

    const sql = neon(process.env.DATABASE_URL);

    const [updated] = await sql`
      UPDATE tickets
      SET status = 'rejected',
          rejected_at = NOW(),
          rejected_by = ${rejectedBy},
          rejection_reason = ${rejectionReason || null},
          archived_at = NOW()
      WHERE id = ${ticketId}
      RETURNING id, status, rejected_at, rejected_by
    `;

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ticket_id: updated.id,
        status: updated.status,
        rejected_at: updated.rejected_at,
        rejected_by: updated.rejected_by,
      },
      message: 'Ticket rejected',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('POST /api/tickets/:id/reject error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// POST /api/tickets/:id/sent - Callback from Make.com on send success
// ============================================================================

async function markTicketSent(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').slice(0, -1).pop();

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const body = req.body || {};
    const sql = neon(process.env.DATABASE_URL);

    // Get extended ticket data for audit
    const [currentTicket] = await sql`
      SELECT
        t.id,
        t.email_id as emailId,
        t.approved_at as approvedAt,
        t.created_at as createdAt,
        t.human_edited as humanEdited,
        t.human_edited_body as humanEditedBody,
        t.triage_result_id as triageResultId,
        ie.received_at as emailReceivedAt,
        ie.from_email as fromEmail,
        tr.reply_body as replyBody,
        tr.confidence,
        tr.category_primary as categoryPrimary
      FROM tickets t
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      WHERE t.id = ${ticketId}
      LIMIT 1
    `;

    if (!currentTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    const finalMessageSent = body.final_message_sent || currentTicket.humaneeditedbody || currentTicket.replybody || '';

    // Determine resolution mechanism
    let resolutionMechanism = currentTicket.humaneedited ? 'human_edited' : 'ai_drafted';

    // Check if draft was proofed
    const [recentProof] = await sql`
      SELECT id FROM draft_proofs
      WHERE ticket_id = ${ticketId}
      ORDER BY proofed_at DESC
      LIMIT 1
    `;

    const wasProofed = !!recentProof;

    if (wasProofed && resolutionMechanism === 'ai_drafted') {
      resolutionMechanism = 'human_proofed';
    }

    // Calculate response time in minutes
    let responseTimeMinutes;
    if (currentTicket.approvedat && currentTicket.emailreceivedat) {
      const diffMs = new Date(currentTicket.approvedat).getTime() - new Date(currentTicket.emailreceivedat).getTime();
      responseTimeMinutes = Math.floor(diffMs / 60000);
    }

    // Update ticket
    const [updated] = await sql`
      UPDATE tickets
      SET send_status = 'sent', sent_at = NOW()
      WHERE id = ${ticketId}
      RETURNING id, send_status, sent_at
    `;

    // Persist send audit
    await sql`
      INSERT INTO send_audit (
        ticket_id, initial_draft, final_message_sent, confidence_rating,
        was_human_edited, was_proofed, resolution_mechanism,
        proof_id, sent_at
      ) VALUES (
        ${ticketId}, ${currentTicket.replybody || ''}, ${finalMessageSent},
        ${currentTicket.confidence}, ${currentTicket.humaneedited},
        ${wasProofed}, ${resolutionMechanism}, ${recentProof?.id || null}, NOW()
      )
    `;

    // Find customer profile for this ticket
    const [profile] = await sql`
      SELECT cp.id
      FROM customer_profiles cp
      INNER JOIN inbound_emails ie ON cp.email = ie.from_email
      WHERE ie.id = ${currentTicket.emailid}
      LIMIT 1
    `;

    // Create outbound contact fact and update profile if exists
    if (profile) {
      // Record outbound contact fact
      await sql`
        INSERT INTO customer_contact_facts (
          customer_profile_id, ticket_id, channel, direction,
          contact_at, response_time_minutes, created_at
        ) VALUES (
          ${profile.id}, ${ticketId}, 'email', 'outbound', NOW(),
          ${responseTimeMinutes || null}, NOW()
        )
      `;

      // Update customer profile last contact activity
      await sql`
        UPDATE customer_profiles
        SET last_contact_at = NOW(),
            last_contact_category = ${currentTicket.categoryprimary},
            updated_at = NOW()
        WHERE id = ${profile.id}
      `;
    }

    return res.status(200).json({
      success: true,
      data: {
        ticket_id: updated.id,
        send_status: updated.send_status,
        sent_at: updated.sent_at,
      },
      message: 'Send status updated and audit recorded',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('POST /api/tickets/:id/sent error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// POST /api/tickets/:id/failed - Callback from Make.com on send failure
// ============================================================================

async function markTicketFailed(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticketId = url.pathname.split('/').slice(0, -1).pop();

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const body = req.body || {};
    const failureReason = body.reason || 'Unknown error';

    const sql = neon(process.env.DATABASE_URL);

    const [updated] = await sql`
      UPDATE tickets
      SET send_status = 'failed',
          send_failed_at = NOW(),
          send_failure_reason = ${failureReason}
      WHERE id = ${ticketId}
      RETURNING id, send_status, send_failed_at, send_failure_reason
    `;

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ticket_id: updated.id,
        send_status: updated.send_status,
        send_failed_at: updated.send_failed_at,
        send_failure_reason: updated.send_failure_reason,
      },
      message: 'Send failure recorded',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('POST /api/tickets/:id/failed error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// ROUTER - Dispatch based on HTTP method and path
// ============================================================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/tickets - List tickets
  if (req.method === 'GET' && pathname === '/api/tickets') {
    return getTickets(req, res);
  }

  // GET /api/tickets/:id - Single ticket
  if (req.method === 'GET' && pathname.match(/^\/api\/tickets\/[^/]+$/)) {
    return getTicket(req, res);
  }

  // POST /api/tickets/:id/approve
  if (req.method === 'POST' && pathname.endsWith('/approve')) {
    return approveTicket(req, res);
  }

  // POST /api/tickets/:id/reject
  if (req.method === 'POST' && pathname.endsWith('/reject')) {
    return rejectTicket(req, res);
  }

  // POST /api/tickets/:id/sent
  if (req.method === 'POST' && pathname.endsWith('/sent')) {
    return markTicketSent(req, res);
  }

  // POST /api/tickets/:id/failed
  if (req.method === 'POST' && pathname.endsWith('/failed')) {
    return markTicketFailed(req, res);
  }

  // 404 for unknown routes
  return res.status(404).json({
    success: false,
    error: 'Not found',
    timestamp: new Date().toISOString(),
  });
}
