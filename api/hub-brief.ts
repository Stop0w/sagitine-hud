import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const CATEGORY_LABELS: Record<string, string> = {
  damaged_missing_faulty: 'Damaged / Missing / Faulty',
  shipping_delivery_order_issue: 'Shipping / Delivery',
  return_refund_exchange: 'Return / Refund / Exchange',
  order_modification_cancellation: 'Order Modification',
  product_usage_guidance: 'Product Usage',
  pre_purchase_question: 'Pre-Purchase Question',
  stock_availability: 'Stock Availability',
  brand_feedback_general: 'Brand Feedback',
  partnership_wholesale_press: 'Partnership / Wholesale',
  account_billing_payment: 'Account / Billing',
  praise_testimonial_ugc: 'Praise / Testimonial',
  spam_solicitation: 'Spam',
  other_uncategorized: 'Other',
};

function getCategoryLabel(key: string): string {
  return CATEGORY_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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

function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

// ---------- Shared metrics queries ----------

async function fetchBriefMetrics(sql: any) {
  const [
    avgResponseTodayRows,
    avgResponse7dRows,
    volumeTodayRows,
    volumeAvg7dRows,
    categoryBreakdownRows,
    correctionRows,
  ] = await Promise.all([
    // Avg response time for tickets sent today
    sql`
      SELECT
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.sent_at - ie.received_at)) / 60), 0) AS avg_minutes,
        COUNT(*)::int AS sent_count
      FROM tickets t
      JOIN inbound_emails ie ON ie.id = t.email_id
      WHERE t.send_status = 'sent'
        AND t.sent_at::date = CURRENT_DATE
    `,
    // Avg response time over last 7 days (excluding today)
    sql`
      SELECT
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.sent_at - ie.received_at)) / 60), 0) AS avg_minutes,
        COUNT(*)::int AS sent_count
      FROM tickets t
      JOIN inbound_emails ie ON ie.id = t.email_id
      WHERE t.send_status = 'sent'
        AND t.sent_at::date >= CURRENT_DATE - INTERVAL '7 days'
        AND t.sent_at::date < CURRENT_DATE
    `,
    // Inbound volume today
    sql`
      SELECT COUNT(*)::int AS cnt
      FROM inbound_emails ie
      WHERE ie.received_at::date = CURRENT_DATE
    `,
    // Avg daily inbound volume over last 7 days (excluding today)
    sql`
      SELECT COALESCE(AVG(daily_count), 0) AS avg_daily
      FROM (
        SELECT ie.received_at::date AS d, COUNT(*)::int AS daily_count
        FROM inbound_emails ie
        WHERE ie.received_at::date >= CURRENT_DATE - INTERVAL '7 days'
          AND ie.received_at::date < CURRENT_DATE
        GROUP BY ie.received_at::date
      ) sub
    `,
    // Category breakdown of open queue
    sql`
      SELECT
        tr.category_primary,
        COUNT(*)::int AS open_count
      FROM tickets t
      JOIN triage_results tr ON tr.id = t.triage_result_id
      WHERE t.status NOT IN ('archived', 'rejected')
        AND t.send_status != 'sent'
      GROUP BY tr.category_primary
      ORDER BY open_count DESC
      LIMIT 3
    `,
    // Operator corrections in last 7 days
    sql`
      SELECT COUNT(*)::int AS correction_count
      FROM learning_signals ls
      WHERE ls.created_at >= NOW() - INTERVAL '7 days'
        AND ls.signal_type IN ('category_correction', 'content_rewrite')
    `,
  ]);

  return {
    avgResponseTodayMinutes: Math.round(Number(avgResponseTodayRows[0]?.avg_minutes ?? 0)),
    sentTodayCount: Number(avgResponseTodayRows[0]?.sent_count ?? 0),
    avgResponse7dMinutes: Math.round(Number(avgResponse7dRows[0]?.avg_minutes ?? 0)),
    sent7dCount: Number(avgResponse7dRows[0]?.sent_count ?? 0),
    volumeToday: Number(volumeTodayRows[0]?.cnt ?? 0),
    volumeAvg7d: Math.round(Number(volumeAvg7dRows[0]?.avg_daily ?? 0)),
    topCategories: categoryBreakdownRows.map((r: any) => ({
      category: getCategoryLabel(r.category_primary),
      count: Number(r.open_count),
    })),
    correctionCount7d: Number(correctionRows[0]?.correction_count ?? 0),
  };
}

// ---------- Haiku AI Summary ----------

async function generateAiSummary(
  briefType: 'morning' | 'evening',
  metrics: Awaited<ReturnType<typeof fetchBriefMetrics>>,
  briefSpecificData: Record<string, any>
): Promise<string> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return '';

  const metricsBlock = [
    `Avg response time today: ${formatWaitTime(metrics.avgResponseTodayMinutes)} (${metrics.sentTodayCount} sent)`,
    `Avg response time last 7 days: ${formatWaitTime(metrics.avgResponse7dMinutes)} (${metrics.sent7dCount} sent)`,
    `Inbound volume today: ${metrics.volumeToday} (7-day avg: ${metrics.volumeAvg7d}/day)`,
    `Top open categories: ${metrics.topCategories.map((c: { category: string; count: number }) => `${c.category} (${c.count})`).join(', ') || 'None'}`,
    `Operator corrections this week: ${metrics.correctionCount7d}`,
  ].join('\n');

  let contextBlock = '';
  let systemPrompt = '';

  if (briefType === 'morning') {
    const { totalOpen, urgentCount, newSinceYesterday, oldestUnanswered } = briefSpecificData;
    contextBlock = [
      `Open queue: ${totalOpen} tickets`,
      `Urgent (score >= 7): ${urgentCount}`,
      `New overnight (last 24h): ${newSinceYesterday}`,
      oldestUnanswered
        ? `Oldest unanswered: ${oldestUnanswered.customerName} — waiting ${formatWaitTime(oldestUnanswered.waitingMinutes)}`
        : 'No unanswered tickets',
    ].join('\n');

    systemPrompt = `You are a sharp executive assistant writing a concise morning briefing for Heidi, the owner of Sagitine (premium shoe storage brand).
Focus ONLY on: queue health, risks that need attention, anything that could be missed.
Do NOT cover what was done yesterday or performance metrics — that is the evening brief's job.
Write 2-4 short sentences. Be direct, operational, no fluff. Use Australian English.
Do NOT use any markdown formatting (no bold, no asterisks, no headings). Plain text only.
If the queue is empty, say so warmly and briefly.
Never use "Unfortunately", "I'm sorry", or "apologise".`;
  } else {
    const { actionedCount, stillOpenCount, newArrivedToday } = briefSpecificData;
    contextBlock = [
      `Actioned today: ${actionedCount} tickets sent`,
      `Still open (carrying over): ${stillOpenCount}`,
      `New arrived today: ${newArrivedToday}`,
    ].join('\n');

    systemPrompt = `You are a sharp executive assistant writing a concise end-of-day summary for Heidi, the owner of Sagitine (premium shoe storage brand).
Focus ONLY on: what got done today, performance (response speed, coverage), anything carrying over and why it matters.
Do NOT cover queue risks or what needs attention tomorrow — that is the morning brief's job.
Write 2-4 short sentences. Be direct, operational, no fluff. Use Australian English.
Do NOT use any markdown formatting (no bold, no asterisks, no headings). Plain text only.
If everything was actioned, acknowledge it positively and briefly.
Never use "Unfortunately", "I'm sorry", or "apologise".`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Here are today's metrics:\n\n${metricsBlock}\n\nBrief-specific:\n${contextBlock}\n\nWrite the ${briefType} summary now.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Haiku brief summary error:', response.status, await response.text());
      return '';
    }

    const json = await response.json();
    const text = json?.content?.[0]?.text ?? '';
    return text.trim();
  } catch (err: any) {
    console.error('Haiku brief summary error:', err.message);
    return '';
  }
}

// ---------- Morning Brief ----------

async function handleMorningBrief(
  sql: any,
  res: VercelResponse
) {
  try {
    const [ticketsRows, metrics] = await Promise.all([
      sql`
        SELECT
          t.id              AS ticket_id,
          ie.from_name,
          ie.from_email,
          ie.subject,
          tr.urgency,
          tr.category_primary,
          ie.received_at,
          EXTRACT(EPOCH FROM (now() - ie.received_at)) / 60 AS waiting_minutes
        FROM tickets t
        JOIN inbound_emails  ie ON ie.id = t.email_id
        JOIN triage_results  tr ON tr.id = t.triage_result_id
        WHERE t.status NOT IN ('archived', 'rejected')
          AND t.send_status != 'sent'
        ORDER BY tr.urgency DESC, ie.received_at ASC
      `,
      fetchBriefMetrics(sql),
    ]);

    const needsResponse = ticketsRows.map((r: any) => ({
      id: r.ticket_id,
      customerName: r.from_name || r.from_email,
      subject: r.subject,
      urgency: mapUrgency(Number(r.urgency)),
      urgencyScore: Number(r.urgency),
      category: r.category_primary,
      receivedAt: r.received_at,
      waitingMinutes: Math.round(Number(r.waiting_minutes)),
    }));

    const totalOpen = needsResponse.length;
    const urgentCount = needsResponse.filter((t: any) => t.urgencyScore >= 7).length;

    const newSinceYesterdayRows = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM tickets t
      JOIN inbound_emails ie ON ie.id = t.email_id
      WHERE t.status NOT IN ('archived', 'rejected')
        AND t.send_status != 'sent'
        AND ie.received_at > now() - interval '24 hours'
    `;
    const newSinceYesterday = newSinceYesterdayRows[0]?.cnt ?? 0;

    const oldestUnanswered = needsResponse.length > 0
      ? needsResponse.reduce((oldest: any, t: any) => t.waitingMinutes > oldest.waitingMinutes ? t : oldest)
      : null;

    const aiSummary = await generateAiSummary('morning', metrics, {
      totalOpen,
      urgentCount,
      newSinceYesterday,
      oldestUnanswered: oldestUnanswered
        ? { customerName: oldestUnanswered.customerName, waitingMinutes: oldestUnanswered.waitingMinutes }
        : null,
    });

    return res.status(200).json({
      success: true,
      data: {
        needsResponse,
        totalOpen,
        urgentCount,
        newSinceYesterday,
        oldestUnanswered: oldestUnanswered
          ? { customerName: oldestUnanswered.customerName, waitingMinutes: oldestUnanswered.waitingMinutes }
          : null,
        aiSummary,
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

// ---------- Evening Brief ----------

async function handleEveningBrief(
  sql: any,
  res: VercelResponse
) {
  try {
    const [actionedRows, stillOpenRows, newTodayRows, metrics] = await Promise.all([
      // Actioned today
      sql`
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
      `,
      // Still open
      sql`
        SELECT
          t.id              AS ticket_id,
          ie.from_name,
          ie.from_email,
          ie.subject,
          tr.urgency,
          tr.category_primary,
          ie.received_at,
          EXTRACT(EPOCH FROM (now() - ie.received_at)) / 60 AS waiting_minutes
        FROM tickets t
        JOIN inbound_emails  ie ON ie.id = t.email_id
        JOIN triage_results  tr ON tr.id = t.triage_result_id
        WHERE t.status NOT IN ('archived', 'rejected')
          AND t.send_status != 'sent'
        ORDER BY tr.urgency DESC, ie.received_at ASC
      `,
      // New arrived today
      sql`
        SELECT COUNT(*)::int AS cnt
        FROM tickets t
        JOIN inbound_emails ie ON ie.id = t.email_id
        WHERE ie.received_at::date = CURRENT_DATE
      `,
      fetchBriefMetrics(sql),
    ]);

    const actionedToday = actionedRows.map((r: any) => ({
      id: r.ticket_id,
      customerName: r.from_name || r.from_email,
      subject: r.subject,
      urgency: 'low' as const,
      category: '',
      waitingMinutes: 0,
      sentAt: r.sent_at,
    }));

    const stillOpen = stillOpenRows.map((r: any) => ({
      id: r.ticket_id,
      customerName: r.from_name || r.from_email,
      subject: r.subject,
      urgency: mapUrgency(Number(r.urgency)),
      urgencyScore: Number(r.urgency),
      category: r.category_primary,
      receivedAt: r.received_at,
      waitingMinutes: Math.round(Number(r.waiting_minutes)),
    }));

    const newArrivedToday = newTodayRows[0]?.cnt ?? 0;

    const aiSummary = await generateAiSummary('evening', metrics, {
      actionedCount: actionedToday.length,
      stillOpenCount: stillOpen.length,
      newArrivedToday,
    });

    return res.status(200).json({
      success: true,
      data: {
        actionedToday,
        actionedCount: actionedToday.length,
        stillOpen,
        stillOpenCount: stillOpen.length,
        newArrivedToday,
        aiSummary,
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
