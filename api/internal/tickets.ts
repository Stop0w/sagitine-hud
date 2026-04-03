// Tickets API endpoints for Sagitine AI CX Agent
import { db } from '../../src/db';
import { tickets, inboundEmails, triageResults, customerProfiles, customerContactFacts, sendAudit, draftProofs } from '../../src/db/schema';
import { eq, desc, and, gte, count, sql } from 'drizzle-orm';
import {
  recordOutboundContactFact,
  updateOutboundActivity,
} from '../../src/api/services/customer-profile-service';

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
    const limit = url.searchParams.get('limit') || '50';

    // Build query conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(tickets.status, status));
    }

    // Join tickets → inbound_emails → triage_results
    const query = db
      .select({
        ticket_id: tickets.id,
        status: tickets.status,
        sendStatus: tickets.sendStatus,
        fromEmail: inboundEmails.fromEmail,
        fromName: inboundEmails.fromName,
        subject: inboundEmails.subject,
        categoryPrimary: triageResults.categoryPrimary,
        confidence: triageResults.confidence,
        urgency: triageResults.urgency,
        riskLevel: triageResults.riskLevel,
        customerIntentSummary: triageResults.customerIntentSummary,
        replySubject: triageResults.replySubject,
        receivedAt: inboundEmails.receivedAt,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .orderBy(desc(tickets.createdAt))
      .limit(parseInt(limit, 10));

    let results = await query;

    // Filter by urgency if specified (post-filter since it's in triage_results)
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

    const result = await db
      .select({
        // Ticket fields
        ticket_id: tickets.id,
        status: tickets.status,
        sendStatus: tickets.sendStatus,
        assignedTo: tickets.assignedTo,
        approvedAt: tickets.approvedAt,
        approvedBy: tickets.approvedBy,
        sentAt: tickets.sentAt,
        rejectedAt: tickets.rejectedAt,
        rejectedBy: tickets.rejectedBy,
        rejectionReason: tickets.rejectionReason,
        humanEdited: tickets.humanEdited,
        humanEditedBody: tickets.humanEditedBody,

        // Email fields
        email_id: inboundEmails.id,
        fromEmail: inboundEmails.fromEmail,
        fromName: inboundEmails.fromName,
        subject: inboundEmails.subject,
        bodyPlain: inboundEmails.bodyPlain,
        bodyHtml: inboundEmails.bodyHtml,
        receivedAt: inboundEmails.receivedAt,

        // Triage result fields
        triage_result_id: triageResults.id,
        categoryPrimary: triageResults.categoryPrimary,
        confidence: triageResults.confidence,
        urgency: triageResults.urgency,
        riskLevel: triageResults.riskLevel,
        riskFlags: triageResults.riskFlags,
        customerIntentSummary: triageResults.customerIntentSummary,
        recommendedNextAction: triageResults.recommendedNextAction,
        safeToAutoDraft: triageResults.safeToAutoDraft,
        safeToAutoSend: triageResults.safeToAutoSend,
        replySubject: triageResults.replySubject,
        replyBody: triageResults.replyBody,
        retrievedKnowledgeIds: triageResults.retrievedKnowledgeIds,
        isMock: triageResults.isMock,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

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

    // ========================================================================
    // DOUBLE-SEND PROTECTION: Check current send_status before updating
    // ========================================================================
    const [currentTicket] = await db
      .select({
        id: tickets.id,
        sendStatus: tickets.sendStatus,
        status: tickets.status,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!currentTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    // If already pending or sent, reject to prevent double-sends
    if (currentTicket.sendStatus === 'pending' || currentTicket.sendStatus === 'sent') {
      return res.status(409).json({
        success: false,
        error: 'Ticket is already being processed or has been sent',
        current_status: currentTicket.status,
        current_send_status: currentTicket.sendStatus,
        message: 'Cannot approve - ticket already in send workflow',
        timestamp: new Date().toISOString(),
      });
    }

    // Update ticket status
    const updateData: any = {
      status: 'approved',
      sendStatus: 'pending',
      approvedAt: new Date(),
      approvedBy,
    };

    if (editedReplyBody) {
      updateData.humanEdited = true;
      updateData.humanEditedBody = editedReplyBody;
    }

    const [updated] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, ticketId))
      .returning();

    // TODO: Trigger Make webhook here
    // Make will call back to /api/tickets/:id/sent on success

    return res.status(200).json({
      success: true,
      data: {
        ticket_id: updated.id,
        status: updated.status,
        send_status: updated.sendStatus,
        approved_at: updated.approvedAt,
        approved_by: updated.approvedBy,
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

    const [updated] = await db
      .update(tickets)
      .set({
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy,
        rejectionReason,
        archivedAt: new Date(), // Archive immediately to remove from queue view
      })
      .where(eq(tickets.id, ticketId))
      .returning();

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
        rejected_at: updated.rejectedAt,
        rejected_by: updated.rejectedBy,
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

    // Get extended ticket data for audit
    const [currentTicket] = await db
      .select({
        id: tickets.id,
        emailId: tickets.emailId,
        approvedAt: tickets.approvedAt,
        createdAt: tickets.createdAt,
        humanEdited: tickets.humanEdited,
        humanEditedBody: tickets.humanEditedBody,
        emailReceivedAt: inboundEmails.receivedAt,
        fromEmail: inboundEmails.fromEmail,
        triageResultId: tickets.triageResultId,
        replyBody: triageResults.replyBody,
        confidence: triageResults.confidence,
        categoryPrimary: triageResults.categoryPrimary,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!currentTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Get request body for optional final message
    const body = req.body || {};
    const finalMessageSent = body.final_message_sent || currentTicket.humanEditedBody || currentTicket.replyBody || '';

    // Determine resolution mechanism
    let resolutionMechanism: 'ai_drafted' | 'human_edited' | 'human_proofed';
    if (currentTicket.humanEdited) {
      resolutionMechanism = 'human_edited';
    } else {
      resolutionMechanism = 'ai_drafted';
    }

    // Check if draft was proofed (look for recent proof record)
    const [recentProof] = await db
      .select({ id: draftProofs.id })
      .from(draftProofs)
      .where(eq(draftProofs.ticketId, ticketId))
      .orderBy(desc(draftProofs.proofedAt))
      .limit(1);

    const wasProofed = !!recentProof;

    // If proofed, update resolution mechanism
    if (wasProofed && resolutionMechanism === 'ai_drafted') {
      resolutionMechanism = 'human_proofed';
    }

    // Calculate response time in minutes (from email received to approved)
    let responseTimeMinutes: number | undefined;
    if (currentTicket.approvedAt && currentTicket.emailReceivedAt) {
      const diffMs = currentTicket.approvedAt.getTime() - currentTicket.emailReceivedAt.getTime();
      responseTimeMinutes = Math.floor(diffMs / 60000);
    }

    const [updated] = await db
      .update(tickets)
      .set({
        sendStatus: 'sent',
        sentAt: new Date(),
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    // Persist send audit
    await db.insert(sendAudit).values({
      ticketId,
      initialDraft: currentTicket.replyBody || '',
      finalMessageSent,
      confidenceRating: currentTicket.confidence,
      wasHumanEdited: currentTicket.humanEdited,
      wasProofed,
      resolutionMechanism,
      proofId: recentProof?.id,
      sentAt: new Date(),
    });

    // Find customer profile for this ticket
    const [profile] = await db
      .select({
        id: customerProfiles.id,
      })
      .from(customerProfiles)
      .innerJoin(inboundEmails, eq(customerProfiles.email, inboundEmails.fromEmail))
      .where(eq(inboundEmails.id, currentTicket.emailId))
      .limit(1);

    // Create outbound contact fact if profile exists
    if (profile) {
      await recordOutboundContactFact({
        customerProfileId: profile.id,
        ticketId: ticketId,
        responseTimeMinutes,
      });

      // Update customer profile with latest outbound activity
      // Does NOT increment counters - only updates timestamp and outcome
      await updateOutboundActivity(profile.id, updated.sentAt!);

      // Update lastContactCategory with current ticket's category
      await db
        .update(customerProfiles)
        .set({
          lastContactCategory: currentTicket.categoryPrimary,
          updatedAt: new Date(),
        })
        .where(eq(customerProfiles.id, profile.id));
    }

    return res.status(200).json({
      success: true,
      data: {
        ticket_id: updated.id,
        send_status: updated.sendStatus,
        sent_at: updated.sentAt,
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

    const [updated] = await db
      .update(tickets)
      .set({
        sendStatus: 'failed',
        sendFailedAt: new Date(),
        sendFailureReason: failureReason,
      })
      .where(eq(tickets.id, ticketId))
      .returning();

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
        send_status: updated.sendStatus,
        send_failed_at: updated.sendFailedAt,
        send_failure_reason: updated.sendFailureReason,
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
