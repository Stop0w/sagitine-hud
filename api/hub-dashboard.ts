// Hub Dashboard API - Combined metrics + categories for single-poll optimisation
import { db } from '../src/db';
import { tickets, inboundEmails, triageResults } from '../src/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

// Helper SQL condition for HUD-visible tickets
const HUD_VISIBLE_CONDITION = sql`
  (
    tickets.status NOT IN ('archived', 'rejected')
    AND tickets.send_status != 'sent'
  )
`;

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
    // ========================================================================
    // PART 1: Top-level metrics
    // ========================================================================
    const [totalOpen] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .where(HUD_VISIBLE_CONDITION);

    const [urgentCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(
        and(
          HUD_VISIBLE_CONDITION,
          sql`(urgency >= 7 OR risk_level = 'high')`
        )
      );

    // Calculate criticality level
    let criticality = 'NOMINAL';
    const totalCount = Number(totalOpen.count);
    const urgentCountNum = Number(urgentCount.count);
    if (totalCount > 0) {
      const urgentRatio = urgentCountNum / totalCount;
      if (urgentRatio > 0.3) criticality = 'CRITICAL';
      else if (urgentRatio > 0.15) criticality = 'ELEVATED';
    }

    // ========================================================================
    // PART 2: Category breakdown
    // ========================================================================
    const categoryData = await db
      .select({
        category: triageResults.categoryPrimary,
        count: sql<number>`COUNT(*)`.as('count'),
        avgUrgency: sql<number>`AVG(${triageResults.urgency})`.as('avg_urgency'),
        avgConfidence: sql<number>`AVG(${triageResults.confidence})`.as('avg_confidence'),
      })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(HUD_VISIBLE_CONDITION)
      .groupBy(triageResults.categoryPrimary);

    // Build category map
    const categoryMap = new Map();
    for (const c of categoryData) {
      categoryMap.set(c.category, c);
    }

    // Build complete category breakdown (all 13 categories)
    const allCategories = Object.keys(CATEGORY_LABELS).map(categoryEnum => {
      const existing = categoryMap.get(categoryEnum);

      // Determine urgency level from avg urgency (or default to 'low' if no tickets)
      let urgency = 'low';
      const avgUrgency = existing?.avgUrgency || 0;
      if (avgUrgency >= 7) urgency = 'high';
      else if (avgUrgency >= 4) urgency = 'medium';

      return {
        category: categoryEnum,
        categoryLabel: getCategoryLabel(categoryEnum),
        count: existing ? Number(existing.count) : 0,
        urgency,
        avgConfidence: existing ? Number(existing.avgConfidence) : 0,
      };
    });

    // ========================================================================
    // PART 3: Fetch queue tickets (progressive disclosure)
    // Limited to most recent 50 tickets
    // ========================================================================
    const riskOrder = sql`
      CASE risk_level
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END
    `;

    const allTickets = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        sendStatus: tickets.sendStatus,
        fromEmail: inboundEmails.fromEmail,
        fromName: inboundEmails.fromName,
        subject: inboundEmails.subject,
        bodyPlain: inboundEmails.bodyPlain,
        category: triageResults.categoryPrimary,
        confidence: triageResults.confidence,
        urgency: triageResults.urgency,
        riskLevel: triageResults.riskLevel,
        receivedAt: inboundEmails.receivedAt,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(HUD_VISIBLE_CONDITION)
      .orderBy(desc(triageResults.urgency))
      .orderBy(riskOrder)
      .orderBy(inboundEmails.receivedAt)
      .limit(50);

    // Add category labels and calculate waiting minutes
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

    // ========================================================================
    // COMBINED RESPONSE
    // ========================================================================
    return res.status(200).json({
      success: true,
      data: {
        total_queue: totalCount,
        urgent_count: urgentCountNum,
        sent_today: 0, // Placeholder - can be calculated from sent_at timestamp
        pending_review: totalCount, // All open tickets need review
        approved: 0,
        rejected: 0,
        queue: enrichedTickets,
        categories: allCategories,
        _timezone: 'Australia/Sydney',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/hub-dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
