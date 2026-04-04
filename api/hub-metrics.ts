// Simple metrics endpoint that works with Vercel's routing
import { db } from '../src/db';
import { tickets, triageResults } from '../src/db/schema';
import { sql, and, eq, desc } from 'drizzle-orm';

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
    // Simple HUD filter condition
    const HUD_VISIBLE = sql`(tickets.status NOT IN ('archived', 'rejected') AND tickets.send_status != 'sent')`;

    // Get total open tickets
    const [totalOpen] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .where(HUD_VISIBLE);

    // Get urgent count
    const [urgentCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(and(HUD_VISIBLE, sql`(urgency >= 7 OR risk_level = 'high')`));

    // Calculate criticality
    const totalCount = Number(totalOpen.count || 0);
    const urgentCountNum = Number(urgentCount.count || 0);
    let criticality = 'NOMINAL';
    if (totalCount > 0 && urgentCountNum / totalCount > 0.3) criticality = 'CRITICAL';
    else if (totalCount > 0 && urgentCountNum / totalCount > 0.15) criticality = 'ELEVATED';

    return res.status(200).json({
      success: true,
      data: {
        totalOpen: totalCount,
        urgentCount: urgentCountNum,
        avgResponseTimeMinutes: 0,
        criticality,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Metrics error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
