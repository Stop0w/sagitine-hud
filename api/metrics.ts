// @ts-nocheck
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, gte, sql, count, inArray, asc } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

// Inline schema to avoid import issues
const schema = {
  tickets: {
    id: 'id',
    status: 'status',
    sendStatus: 'send_status',
    triageResultId: 'triage_result_id',
    emailId: 'email_id',
    sentAt: 'sent_at',
    createdAt: 'created_at',
  },
  triageResults: {
    id: 'id',
    categoryPrimary: 'category_primary',
    urgency: 'urgency',
    riskLevel: 'risk_level',
  },
  inboundEmails: {
    id: 'id',
    fromEmail: 'from_email',
    fromName: 'from_name',
    subject: 'subject',
    bodyPlain: 'body_plain',
    receivedAt: 'received_at',
  }
};

export default async function handler(req, res) {
  console.log('[METRICS] Direct DB connection test invoked');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('[METRICS] Testing direct DB connection...');
    const sql = neon(process.env.DATABASE_URL);
    const db_conn = drizzle(sql, { schema });

    const result = await db_conn
      .select({ count: count() })
      .from(schema.tickets)
      .limit(1);

    console.log('[METRICS] DB test successful:', result);

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
      },
      timestamp: new Date().toISOString(),
      version: 'direct-db-connection'
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
