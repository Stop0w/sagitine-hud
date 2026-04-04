// @ts-nocheck
// POST /api/tickets-send-status - Mark ticket as sent by Outlook Thread ID
// Called by Make.com when human sends an AI-drafted email from Outlook
//
// Usage: POST /api/tickets-send-status?id=<outlook-thread-id>
// Body: { "sent_at": "2024-04-02T10:30:00Z", "sent_by": "Heidi" }
//
// IMPORTANT: Use the Outlook Conversation ID (Thread ID), not the individual Message ID.
// The Thread ID is consistent across the entire conversation (both inbound and outbound messages).
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

interface SendStatusRequestBody {
  sent_at: string;
  sent_by?: string;
}

interface SendStatusResponse {
  success: boolean;
  ticket_id?: string;
  outlook_thread_id?: string;
  message?: string;
  error?: string;
  timestamp: string;
}

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString(),
    } as SendStatusResponse);
  }

  let outlookThreadId: string | null = null;
  let sent_at: string | undefined;
  let sent_by: string | undefined;

  try {
    outlookThreadId = req.query.id;

    console.log('=== SEND STATUS REQUEST ===');
    console.log('Outlook Thread ID:', outlookThreadId);
    console.log('Request URL:', req.url);

    if (!outlookThreadId) {
      return res.status(400).json({
        success: false,
        error: 'Outlook Thread ID is required (query param: id)',
        example: '/api/tickets-send-status?id=<outlook-thread-id>',
        note: 'Use the Conversation ID from Outlook (Thread ID), not the individual Message ID',
        timestamp: new Date().toISOString(),
      } as SendStatusResponse);
    }

    const body: SendStatusRequestBody = req.body;
    sent_at = body.sent_at;
    sent_by = body.sent_by;

    console.log('Request body:', JSON.stringify(body));
    console.log('Parsed sent_at:', sent_at, 'Type:', typeof sent_at);

    if (!sent_at) {
      return res.status(400).json({
        success: false,
        error: 'sent_at is required (ISO timestamp)',
        timestamp: new Date().toISOString(),
      } as SendStatusResponse);
    }

    // Create database connection inside handler
    const sql = neon(process.env.DATABASE_URL!);

    // Find ticket by sourceThreadId (Conversation ID)
    // This works because both inbound and outbound messages in the same thread share the same Thread ID
    console.log('Looking up ticket for Outlook Thread ID:', outlookThreadId);

    const [ticket] = await sql`
      SELECT t.id, t.email_id as emailId, t.send_status as sendStatus, t.sent_at as sentAt
      FROM tickets t
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      WHERE ie.source_thread_id = ${outlookThreadId}
      LIMIT 1
    `;

    if (!ticket) {
      console.log('No ticket found for Outlook Thread ID:', outlookThreadId);
      return res.status(404).json({
        success: false,
        error: 'Ticket not found for this Outlook Thread ID',
        details: `Searched for source_thread_id: ${outlookThreadId}`,
        note: 'Make sure you are passing the Conversation/Thread ID, not the individual Message ID',
        timestamp: new Date().toISOString(),
      } as SendStatusResponse);
    }

    console.log('Found ticket:', ticket.id, 'Current send_status:', ticket.sendstatus);

    // Update ticket
    console.log('Updating ticket send_status to sent, sent_at:', sent_at);

    await sql`
      UPDATE tickets
      SET send_status = 'sent', sent_at = ${new Date(sent_at)}
      WHERE id = ${ticket.id}
    `;

    console.log('Ticket updated successfully');

    return res.status(200).json({
      success: true,
      ticket_id: ticket.id,
      outlook_thread_id: outlookThreadId,
      message: 'Ticket marked as sent',
      timestamp: new Date().toISOString(),
    } as SendStatusResponse);

  } catch (error: any) {
    console.error('=== SEND STATUS ENDPOINT ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Outlook Thread ID:', outlookThreadId);
    console.error('Request body:', { sent_at, sent_by });

    // Provide detailed error info
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      outlook_thread_id: outlookThreadId,
      timestamp: new Date().toISOString(),
    } as SendStatusResponse);
  }
}
