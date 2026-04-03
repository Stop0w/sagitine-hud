// @ts-nocheck
// Metrics API endpoint for Sagitine AI CX Agent
import { db } from '../src/db';
import { tickets, triageResults, inboundEmails } from '../src/db/schema';
import { eq, and, gte, sql, count, inArray, asc } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  console.log('[METRICS] Function invoked');

  try {
    console.log('[METRICS] Initializing imports...');
    console.log('[METRICS] db available:', !!db);
    console.log('[METRICS] tickets available:', !!tickets);

    // Test database connection
    console.log('[METRICS] Testing database connection...');
    const result = await db.select({ count: count() }).from(tickets).limit(1);
    console.log('[METRICS] DB query result:', result);

    return res.status(200).json({
      success: true,
      data: {
        total_queue: result[0]?.count || 0,
        urgent_count: 0,
        sent_today: 0,
        pending_review: 0,
        approved: 0,
        rejected: 0,
        queue: [],
        _timezone: 'Australia/Sydney',
        _debug: 'database_test'
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[METRICS] Error:', error);
    console.error('[METRICS] Error stack:', error.stack);
    console.error('[METRICS] Error message:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
}
