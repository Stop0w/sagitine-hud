import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ALLOWED_ORIGIN = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString(),
    });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/api/hub-brief/morning') {
    return handleMorningBrief(sql, res);
  } else if (pathname === '/api/hub-brief/evening') {
    return handleEveningBrief(sql, res);
  } else {
    return res.status(404).json({
      success: false,
      error: 'Not found',
      timestamp: new Date().toISOString(),
    });
  }
}

function mapUrgency(score: number): 'low' | 'medium' | 'high' {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

async function handleMorningBrief(
  sql: any,
  res: VercelResponse
) {
  try {
    const ticketsRows = await sql`
      SELECT
        t.id              AS ticket_id,
        ie.from_name,
        ie.from_email,
        ie.subject,
        tr.urgency_score,
        tr.category_primary,
        ie.received_at,
        EXTRACT(EPOCH FROM (now() - ie.received_at)) / 60 AS waiting_minutes
      FROM tickets t
      JOIN inbound_emails  ie ON ie.id = t.email_id
      JOIN triage_results  tr ON tr.id = t.triage_result_id
      WHERE t.status NOT IN ('archived', 'rejected')
        AND t.send_status != 'sent'
      ORDER BY tr.urgency_score DESC, ie.received_at ASC
    `;

    const tickets = ticketsRows.map((r: any) => ({
      ticketId: r.ticket_id,
      fromName: r.from_name,
      fromEmail: r.from_email,
      subject: r.subject,
      urgency: mapUrgency(Number(r.urgency_score)),
      urgencyScore: Number(r.urgency_score),
      categoryPrimary: r.category_primary,
      receivedAt: r.received_at,
      waitingMinutes: Math.round(Number(r.waiting_minutes)),
    }));

    const totalOpen = tickets.length;
    const urgentCount = tickets.filter((t: any) => t.urgencyScore >= 7).length;

    const newSinceYesterdayRows = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM tickets t
      JOIN inbound_emails ie ON ie.id = t.email_id
      WHERE t.status NOT IN ('archived', 'rejected')
        AND t.send_status != 'sent'
        AND ie.received_at > now() - interval '24 hours'
    `;
    const newSinceYesterday = newSinceYesterdayRows[0]?.cnt ?? 0;

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        totalOpen,
        urgentCount,
        newSinceYesterday,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Morning brief error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleEveningBrief(
  sql: any,
  res: VercelResponse
) {
  try {
    // Actioned today
    const actionedRows = await sql`
      SELECT
        t.id              AS ticket_id,
        ie.from_name,
        ie.from_email,
        ie.subject,
        t.sent_at
      FROM tickets t
      JOIN inbound_emails ie ON ie.id = t.email_id
      WHERE t.send_status = 'sent'
        AND t.sent_at::date = CURRENT_DATE
      ORDER BY t.sent_at DESC
    `;

    const actionedToday = actionedRows.map((r: any) => ({
      ticketId: r.ticket_id,
      fromName: r.from_name,
      fromEmail: r.from_email,
      subject: r.subject,
      sentAt: r.sent_at,
    }));

    // Still open (same criteria as morning)
    const stillOpenRows = await sql`
      SELECT
        t.id              AS ticket_id,
        ie.from_name,
        ie.from_email,
        ie.subject,
        tr.urgency_score,
        tr.category_primary,
        ie.received_at,
        EXTRACT(EPOCH FROM (now() - ie.received_at)) / 60 AS waiting_minutes
      FROM tickets t
      JOIN inbound_emails  ie ON ie.id = t.email_id
      JOIN triage_results  tr ON tr.id = t.triage_result_id
      WHERE t.status NOT IN ('archived', 'rejected')
        AND t.send_status != 'sent'
      ORDER BY tr.urgency_score DESC, ie.received_at ASC
    `;

    const stillOpen = stillOpenRows.map((r: any) => ({
      ticketId: r.ticket_id,
      fromName: r.from_name,
      fromEmail: r.from_email,
      subject: r.subject,
      urgency: mapUrgency(Number(r.urgency_score)),
      urgencyScore: Number(r.urgency_score),
      categoryPrimary: r.category_primary,
      receivedAt: r.received_at,
      waitingMinutes: Math.round(Number(r.waiting_minutes)),
    }));

    // New arrived today
    const newTodayRows = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM tickets t
      JOIN inbound_emails ie ON ie.id = t.email_id
      WHERE ie.received_at::date = CURRENT_DATE
    `;
    const newArrivedToday = newTodayRows[0]?.cnt ?? 0;

    return res.status(200).json({
      success: true,
      data: {
        actionedToday,
        actionedCount: actionedToday.length,
        stillOpen,
        stillOpenCount: stillOpen.length,
        newArrivedToday,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Evening brief error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
