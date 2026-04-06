// Hub Dashboard API - Using raw SQL to avoid schema import issues
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

// NOTE: This map is intentionally duplicated in api/hub.ts (Vercel self-contained function rule —
// no cross-file imports allowed). If you update labels here, update api/hub.ts CATEGORY_LABELS too.
const CATEGORY_LABELS: Record<string, string> = {
  damaged_missing_faulty: 'Damaged & Faulty',
  shipping_delivery_order_issue: 'Shipping & Delivery',
  product_usage_guidance: 'Product Usage',
  pre_purchase_question: 'Pre-Purchase',
  return_refund_exchange: 'Return & Refund',
  stock_availability: 'Stock Availability',
  partnership_wholesale_press: 'Partnership & Press',
  brand_feedback_general: 'Brand Feedback',
  spam_solicitation: 'Spam & Solicitation',
  other_uncategorized: 'Other',
  account_billing_payment: 'Account & Billing',
  order_modification_cancellation: 'Order Modification',
  praise_testimonial_ugc: 'Praise & Feedback',
};

function getCategoryLabel(categoryEnum: string): string {
  return CATEGORY_LABELS[categoryEnum] || categoryEnum;
}

// Restrict CORS to the Vercel deployment URL. Falls back to localhost for local dev.
const ALLOWED_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5173';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Get Sydney timezone for today's date
    const now = new Date();
    const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const startOfDay = new Date(sydneyTime);
    startOfDay.setHours(0, 0, 0, 0);

    // Run all queries in parallel — none depend on each other's results.
    // COUNT(*) always returns exactly 1 row, so [result] destructuring is safe.
    const [
      [totalQueueResult],
      [urgentResult],
      [sentTodayResult],
      [pendingReviewResult],
      [approvedResult],
      [rejectedResult],
      queueItems,
      categoryStats,
    ] = await Promise.all([

      // Total open queue
      sql`
        SELECT COUNT(*) as count
        FROM tickets
        WHERE (status = 'new' OR status = 'classified')
        AND archived_at IS NULL
        AND send_status != 'sent'
      `,

      // Urgent tickets (urgency >= 7) in the open queue
      sql`
        SELECT COUNT(*) as count
        FROM tickets t
        INNER JOIN triage_results tr ON t.triage_result_id = tr.id
        WHERE (t.status = 'new' OR t.status = 'classified')
        AND t.archived_at IS NULL
        AND t.send_status != 'sent'
        AND tr.urgency >= 7
      `,

      // Sent today (Sydney time)
      sql`
        SELECT COUNT(*) as count
        FROM tickets
        WHERE send_status = 'sent'
        AND sent_at >= ${startOfDay.toISOString()}
      `,

      // Pending operator review
      sql`
        SELECT COUNT(*) as count
        FROM tickets
        WHERE status = 'classified'
        AND archived_at IS NULL
        AND send_status != 'sent'
      `,

      // Approved total
      sql`SELECT COUNT(*) as count FROM tickets WHERE status = 'approved'`,

      // Rejected total
      sql`SELECT COUNT(*) as count FROM tickets WHERE status = 'rejected'`,

      // Queue items (latest 50, with email + triage join)
      sql`
        SELECT
          t.id as ticket_id,
          ie.id as email_id,
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
        AND t.send_status != 'sent'
        ORDER BY t.created_at DESC
        LIMIT 50
      `,

      // Category breakdown (count, avg confidence, max urgency per category)
      sql`
        SELECT
          tr.category_primary as categoryPrimary,
          COUNT(*) as count,
          AVG(tr.confidence)::numeric as avgConfidence,
          MAX(tr.urgency) as maxUrgency
        FROM tickets t
        INNER JOIN triage_results tr ON t.triage_result_id = tr.id
        WHERE (t.status = 'new' OR t.status = 'classified')
        AND t.archived_at IS NULL
        AND t.send_status != 'sent'
        GROUP BY tr.category_primary
      `,
    ]);

    const total_queue    = parseInt(totalQueueResult.count)    || 0;
    const urgent_count   = parseInt(urgentResult.count)        || 0;
    const sent_today     = parseInt(sentTodayResult.count)     || 0;
    const pending_review = parseInt(pendingReviewResult.count) || 0;
    const approved       = parseInt(approvedResult.count)      || 0;
    const rejected       = parseInt(rejectedResult.count)      || 0;

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
