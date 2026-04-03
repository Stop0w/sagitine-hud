// Metrics API endpoint for Sagitine AI CX Agent
import { db } from '../src/db';
import { tickets, triageResults, inboundEmails } from '../src/db/schema';
import { eq, and, gte, sql, count, or, inArray, asc } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

/**
 * Get start of day in Australia/Sydney timezone (AEST/AEDT)
 * Sydney is UTC+10 (standard) or UTC+11 (daylight saving)
 */
function getSydneyTodayStart(): Date {
  const now = new Date();

  // Get Sydney timezone offset (UTC+10 or UTC+11 depending on DST)
  // Format: "Australia/Sydney" can be used with Intl API
  const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  sydneyTime.setHours(0, 0, 0, 0);

  // Convert back to UTC by calculating the offset
  const sydneyOffset = now.getTimezoneOffset() - (now.toLocaleString('en-US', { timeZone: 'Australia/Sydney', timeZoneName: 'short' }).includes('GMT+11') ? 660 : 600);
  const utcTodayStart = new Date(sydneyTime.getTime() + sydneyOffset * 60000);

  return utcTodayStart;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get today's date in Sydney timezone
    const sydneyTodayStart = getSydneyTodayStart();

    // Queue definition: status IN ('new', 'classified') AND send_status != 'sent'
    const queueCondition = and(
      inArray(tickets.status, ['new', 'classified']),
      sql`${tickets.sendStatus} != 'sent'`
    );

    // Execute all queries in parallel
    const [
      totalQueueResult,
      urgentCountResult,
      sentTodayResult,
      pendingReviewResult,
      approvedResult,
      rejectedResult,
      queueData,
    ] = await Promise.all([
      // Total queue: new or classified, not yet sent
      db
        .select({ count: count() })
        .from(tickets)
        .where(queueCondition),

      // Urgent: urgency >= 8 AND in queue
      db
        .select({ count: count() })
        .from(tickets)
        .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
        .where(
          and(
            queueCondition,
            gte(triageResults.urgency, 8)
          )
        ),

      // Sent today: send_status = 'sent' AND sent_at >= sydney_today_start
      db
        .select({ count: count() })
        .from(tickets)
        .where(
          and(
            eq(tickets.sendStatus, 'sent'),
            sql`${tickets.sentAt} >= ${sydneyTodayStart}`
          )
        ),

      // Pending review: status = 'classified'
      db
        .select({ count: count() })
        .from(tickets)
        .where(eq(tickets.status, 'classified')),

      // Approved: status = 'approved'
      db
        .select({ count: count() })
        .from(tickets)
        .where(eq(tickets.status, 'approved')),

      // Rejected: status = 'rejected'
      db
        .select({ count: count() })
        .from(tickets)
        .where(eq(tickets.status, 'rejected')),

      // Queue data: full ticket details for the UI
      db
        .select({
          id: tickets.id,
          fromEmail: inboundEmails.fromEmail,
          fromName: inboundEmails.fromName,
          subject: inboundEmails.subject,
          bodyPlain: inboundEmails.bodyPlain,
          receivedAt: inboundEmails.receivedAt,
          category: triageResults.categoryPrimary,
          urgency: triageResults.urgency,
          riskLevel: triageResults.riskLevel,
          status: tickets.status,
        })
        .from(tickets)
        .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
        .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
        .where(queueCondition)
        .orderBy(asc(inboundEmails.receivedAt))
        .limit(100),
    ]);

    const metrics = {
      total_queue: totalQueueResult[0]?.count || 0,
      urgent_count: urgentCountResult[0]?.count || 0,
      sent_today: sentTodayResult[0]?.count || 0,
      pending_review: pendingReviewResult[0]?.count || 0,
      approved: approvedResult[0]?.count || 0,
      rejected: rejectedResult[0]?.count || 0,
      queue: queueData.map(t => ({
        id: t.id,
        from_email: t.fromEmail,
        from_name: t.fromName,
        subject: t.subject,
        body_plain: t.bodyPlain,
        received_at: t.receivedAt?.toISOString() || new Date().toISOString(),
        category: t.category,
        urgency: t.urgency,
        risk_level: t.riskLevel,
        status: t.status,
      })),
      _timezone: 'Australia/Sydney',
    };

    return res.status(200).json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/metrics error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
