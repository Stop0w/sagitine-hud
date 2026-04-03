// Hub Dashboard API - Combined metrics + categories for single-poll optimisation
import { db } from '../src/db';
import { tickets, inboundEmails, triageResults } from '../src/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

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
    console.log('Fetching dashboard data...');

    // Simple test query first
    const [totalOpen] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets);

    console.log('Total tickets:', totalOpen);

    const [urgentCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(sql`urgency >= 7`);

    console.log('Urgent tickets:', urgentCount);

    const categoryData = await db
      .select({
        category: triageResults.categoryPrimary,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .groupBy(triageResults.categoryPrimary);

    console.log('Categories found:', categoryData.length);

    const allTickets = await db
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
      .orderBy(desc(inboundEmails.receivedAt))
      .limit(50);

    console.log('Tickets found:', allTickets.length);

    const enrichedTickets = allTickets.map(t => {
      const received = new Date(t.receivedAt);
      const now = new Date();
      const waitingMinutes = Math.round((now.getTime() - received.getTime()) / 60000);

      return {
        id: t.id,
        from_email: t.fromEmail,
        from_name: t.fromName,
        subject: t.subject,
        body_plain: t.bodyPlain || '',
        received_at: t.receivedAt,
        category: t.category,
        urgency: t.urgency,
        risk_level: t.riskLevel,
        status: t.status,
        waitingMinutes,
      };
    });

    console.log('Returning dashboard data with', enrichedTickets.length, 'tickets');

    return res.status(200).json({
      success: true,
      data: {
        total_queue: Number(totalOpen.count),
        urgent_count: Number(urgentCount.count),
        sent_today: 0,
        pending_review: Number(totalOpen.count),
        approved: 0,
        rejected: 0,
        queue: enrichedTickets,
        categories: categoryData.map((c: any) => ({
          category: c.category,
          categoryLabel: c.category,
          count: Number(c.count),
          urgency: 'low',
          avgConfidence: 0.75,
        })),
        _timezone: 'Australia/Sydney',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('ERROR in /api/hub-dashboard:', error);
    console.error('Error stack:', error.stack);

    // Return safe fallback
    return res.status(200).json({
      success: true,
      data: {
        total_queue: 0,
        urgent_count: 0,
        sent_today: 0,
        pending_review: 0,
        approved: 0,
        rejected: 0,
        queue: [],
        categories: [],
        _timezone: 'Australia/Sydney',
        _fallback: true,
        _error: error.message
      },
      timestamp: new Date().toISOString(),
    });
  }
}
