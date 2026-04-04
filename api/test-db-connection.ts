// @ts-nocheck
// Test database connection pattern
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { tickets } from '../src/db/schema';
import { count } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[TEST DB] Starting database connection test...');

    // Test environment variable
    if (!process.env.DATABASE_URL) {
      console.error('[TEST DB] DATABASE_URL not found');
      return res.status(500).json({
        success: false,
        error: 'DATABASE_URL environment variable not set',
        timestamp: new Date().toISOString(),
      });
    }

    console.log('[TEST DB] DATABASE_URL found, length:', process.env.DATABASE_URL.length);

    // Create database connection
    console.log('[TEST DB] Creating neon connection...');
    const sql = neon(process.env.DATABASE_URL);
    console.log('[TEST DB] Creating drizzle instance...');
    const db = drizzle(sql);

    // Test query
    console.log('[TEST DB] Executing test query...');
    const [result] = await db
      .select({ count: count() })
      .from(tickets)
      .limit(1);

    console.log('[TEST DB] Query result:', result);

    return res.status(200).json({
      success: true,
      database: 'connected',
      totalTickets: result?.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[TEST DB] Error:', error);
    console.error('[TEST DB] Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
}
