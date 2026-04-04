// @ts-nocheck
// Simple test without schema imports
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[SIMPLE TEST] Starting...');

    // Test environment variable
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_URL not set',
        timestamp: new Date().toISOString(),
      });
    }

    console.log('[SIMPLE TEST] Creating connections...');
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    console.log('[SIMPLE TEST] Running raw SQL query...');
    const result = await sql`SELECT COUNT(*) as count FROM tickets`;

    console.log('[SIMPLE TEST] Result:', result);

    return res.status(200).json({
      success: true,
      count: result[0]?.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[SIMPLE TEST] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
