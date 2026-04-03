// Simple health check for database connectivity
import { db } from '../src/db';
import { tickets } from '../src/db/schema';
import { sql } from 'drizzle-orm';

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
    // Simple database connection test
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .limit(1);

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      totalTickets: result?.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
