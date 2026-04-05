// @ts-nocheck
// Hub Metrics API - Using raw SQL to avoid schema import issues
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

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

    // Query: Total open tickets
    const [totalOpenResult] = await sql`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE (status = 'new' OR status = 'classified' OR status = 'approved')
      AND archived_at IS NULL
    `;
    const totalOpen = parseInt(totalOpenResult.count) || 0;

    // Query: Urgent tickets
    const [urgentResult] = await sql`
      SELECT COUNT(*) as count
      FROM tickets t
      INNER JOIN triage_results tr ON t.triage_result_id = tr.id
      WHERE (t.status = 'new' OR t.status = 'classified')
      AND t.archived_at IS NULL
      AND tr.urgency >= 7
    `;
    const urgentCount = parseInt(urgentResult.count) || 0;

    // Query: Average response time
    const [avgResponseTimeResult] = await sql`
      SELECT AVG(
        EXTRACT(EPOCH FROM (t.approved_at - ie.received_at)) / 60
      )::integer as avgMinutes
      FROM tickets t
      INNER JOIN inbound_emails ie ON t.email_id = ie.id
      WHERE t.status = 'approved'
      AND t.approved_at IS NOT NULL
    `;
    const avgResponseTimeMinutes = avgResponseTimeResult.avgminutes || 0;

    // Determine criticality
    let criticality = 'NOMINAL';
    if (urgentCount >= 10 || avgResponseTimeMinutes > 120) {
      criticality = 'HIGH';
    } else if (urgentCount >= 5 || avgResponseTimeMinutes > 60) {
      criticality = 'ELEVATED';
    }

    return res.status(200).json({
      success: true,
      data: {
        totalOpen,
        urgentCount,
        avgResponseTimeMinutes,
        criticality,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[METRICS] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
