// @ts-nocheck
// Hub Dashboard API - Using raw SQL to avoid schema import issues
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

const CATEGORY_LABELS: Record<string, string> = {
  damaged_missing_faulty: 'Damaged & Faulty',
  shipping_delivery:      'Shipping & Delivery',
  product_usage:          'Product Usage',
  pre_purchase:           'Pre-Purchase',
  returns:                'Returns & Exchanges',
  stock:                  'Stock Availability',
  partnerships:           'Partnerships & Press',
  brand_feedback:         'Brand Feedback',
  spam:                   'Spam & Solicitation',
};

function getCategoryLabel(categoryEnum: string): string {
  return CATEGORY_LABELS[categoryEnum] || categoryEnum;
}

export default async function handler(req: any, res: any) {
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
    const sql = neon(process.env.DATABASE_URL);

    // Get Sydney timezone for today's date
    const now = new Date();
    const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const startOfDay = new Date(sydneyTime);
    startOfDay.setHours(0, 0, 0, 0);

    // Query: Total queue
    const [totalQueueResult] = await sql`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE (status = 'new' OR status = 'classified')
      AND archived_at IS NULL
    `;
    const total_queue = parseInt(totalQueueResult.count) || 0;

    // Query: Urgent count
    const [urgentResult] = await sql`
      SELECT COUNT(*) as count
      FROM tickets t
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      WHERE (t.status = 'new' OR t.status = 'classified')
      AND t.archived_at IS NULL
      AND tr.urgency >= 7
    `;
    const urgent_count = parseInt(urgentResult.count) || 0;

    // Query: Sent today
    const [sentTodayResult] = await sql`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE send_status = 'sent'
      AND sent_at >= ${startOfDay.toISOString()}
    `;
    const sent_today = parseInt(sentTodayResult.count) || 0;

    // Query: Pending review
    const [pendingReviewResult] = await sql`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE status = 'classified'
      AND archived_at IS NULL
    `;
    const pending_review = parseInt(pendingReviewResult.count) || 0;

    // Query: Approved and rejected
    const [approvedResult] = await sql`
      SELECT COUNT(*) as count FROM tickets WHERE status = 'approved'
    `;
    const approved = parseInt(approvedResult.count) || 0;

    const [rejectedResult] = await sql`
      SELECT COUNT(*) as count FROM tickets WHERE status = 'rejected'
    `;
    const rejected = parseInt(rejectedResult.count) || 0;

    // Query: Queue items
    const queueItems = await sql`
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
      WHERE (t.status = 'new' OR t.status = 'classified')
      AND t.archived_at IS NULL
      ORDER BY t.created_at DESC
      LIMIT 50
    `;

    // Query: Category breakdowns
    const categoryStats = await sql`
      SELECT
        tr.category_primary as categoryPrimary,
        COUNT(*) as count,
        AVG(tr.confidence)::numeric as avgConfidence,
        MAX(tr.urgency) as maxUrgency
      FROM tickets t
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      WHERE (t.status = 'new' OR t.status = 'classified')
      AND t.archived_at IS NULL
      GROUP BY tr.category_primary
    `;

    // Build categories map
    const categoriesMap = new Map();
    categoryStats.forEach(stat => {
      categoriesMap.set(stat.categoryprimary, {
        category: stat.categoryprimary,
        categoryLabel: getCategoryLabel(stat.categoryprimary),
        count: parseInt(stat.count) || 0,
        urgency: stat.maxurgency >= 7 ? 'high' : stat.maxurgency >= 4 ? 'medium' : 'low',
        avgConfidence: parseFloat(stat.avgconfidence) || 0,
      });
    });

    // Ensure all categories are represented
    const categories = Object.keys(CATEGORY_LABELS).map(categoryEnum => {
      if (categoriesMap.has(categoryEnum)) {
        return categoriesMap.get(categoryEnum);
      }
      return {
        category: categoryEnum,
        categoryLabel: getCategoryLabel(categoryEnum),
        count: 0,
        urgency: 'low',
        avgConfidence: 0,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        total_queue,
        urgent_count,
        sent_today,
        pending_review,
        approved,
        rejected,
        queue: queueItems,
        categories,
        _timezone: 'Australia/Sydney',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[HUB DASHBOARD] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
