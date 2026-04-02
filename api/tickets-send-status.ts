// POST /api/tickets-send-status - Mark ticket as sent by Outlook Message ID
// Called by Make.com when human sends an AI-drafted email from Outlook
//
// Usage: POST /api/tickets-send-status?id=<outlook-message-id>
// Body: { "sent_at": "2024-04-02T10:30:00Z", "sent_by": "Heidi" }
import { db } from '../src/db';
import { tickets, inboundEmails } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

interface SendStatusRequestBody {
  sent_at: string; // ISO timestamp
  sent_by?: string;
}

interface SendStatusResponse {
  success: boolean;
  ticket_id?: string;
  outlook_message_id?: string;
  message?: string;
  error?: string;
  timestamp: string;
}

export default async function handler(req: Request): Promise<Response> {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed',
        timestamp: new Date().toISOString(),
      } as SendStatusResponse),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const url = new URL(req.url);
    const outlookMessageId = url.searchParams.get('id');

    if (!outlookMessageId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Outlook Message ID is required (query param: id)',
          example: '/api/tickets-send-status?id=<outlook-message-id>',
          timestamp: new Date().toISOString(),
        } as SendStatusResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: SendStatusRequestBody = await req.json();
    const { sent_at, sent_by } = body;

    if (!sent_at) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'sent_at is required (ISO timestamp)',
          timestamp: new Date().toISOString(),
        } as SendStatusResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find ticket by sourceMessageId
    const [ticket] = await db
      .select({
        id: tickets.id,
        emailId: tickets.emailId,
        sendStatus: tickets.sendStatus,
        sentAt: tickets.sentAt,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .where(eq(inboundEmails.sourceMessageId, outlookMessageId))
      .limit(1);

    if (!ticket) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ticket not found for this Outlook Message ID',
          timestamp: new Date().toISOString(),
        } as SendStatusResponse),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update ticket
    await db
      .update(tickets)
      .set({
        sendStatus: 'sent',
        sentAt: new Date(sent_at),
      })
      .where(eq(tickets.id, ticket.id));

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticket.id,
        outlook_message_id: outlookMessageId,
        message: 'Ticket marked as sent',
        timestamp: new Date().toISOString(),
      } as SendStatusResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Send status endpoint error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      } as SendStatusResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
