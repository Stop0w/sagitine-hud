// @ts-nocheck
// Metrics API endpoint for Sagitine AI CX Agent
import { db } from '../src/db';
import { eq, and, gte, sql, count, inArray, asc } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  console.log('[METRICS] Inline schema test invoked');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('[METRICS] Testing with inline schema...');

    // Get tables directly from db schema
    const { tickets, triageResults, inboundEmails } = db.schema;

    const testResult = await db
      .select({ count: count() })
      .from(tickets)
      .limit(1);

    console.log('[METRICS] DB test successful:', testResult);

    return res.status(200).json({
      success: true,
      data: {
        total_queue: testResult[0]?.count || 0,
        urgent_count: 0,
        sent_today: 0,
        pending_review: 0,
        approved: 0,
        rejected: 0,
        queue: [],
        _timezone: 'Australia/Sydney',
      },
      timestamp: new Date().toISOString(),
      version: 'inline-schema'
    });
  } catch (error) {
    console.error('[METRICS] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
    });
  }
}
