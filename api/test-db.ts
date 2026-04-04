// Test database connection and query
import { db } from '../src/db/index.js';
import { tickets, inboundEmails } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request) {
  try {
    console.log('=== TEST DB CONNECTION ===');

    // Test 1: Check if database is connected
    console.log('Attempting to query tickets table...');

    const allTickets = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        sendStatus: tickets.sendStatus,
      })
      .from(tickets)
      .limit(5);

    console.log('Found', allTickets.length, 'tickets');

    // Test 2: Check if we can find emails
    const allEmails = await db
      .select({
        id: inboundEmails.id,
        sourceMessageId: inboundEmails.sourceMessageId,
        fromEmail: inboundEmails.fromEmail,
      })
      .from(inboundEmails)
      .limit(5);

    console.log('Found', allEmails.length, 'emails');

    // Test 3: Try to join them
    const joined = await db
      .select({
        ticketId: tickets.id,
        messageId: inboundEmails.sourceMessageId,
        fromEmail: inboundEmails.fromEmail,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .limit(5);

    console.log('Joined query found', joined.length, 'records');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tickets_count: allTickets.length,
          emails_count: allEmails.length,
          joined_count: joined.length,
          sample_tickets: allTickets,
          sample_emails: allEmails.map(e => ({
            id: e.id,
            source_message_id: e.sourceMessageId?.substring(0, 50) + '...',
            from_email: e.fromEmail,
          })),
          sample_joined: joined,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('DB TEST ERROR:', error);
    console.error('Error stack:', error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
