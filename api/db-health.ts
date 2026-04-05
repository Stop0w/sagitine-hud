// @ts-nocheck
// Simple health check for database connectivity
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
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
    // Create database connection inside handler
    const sql = neon(process.env.DATABASE_URL!);

    // Simple database connection test
    const [result] = await sql`
      SELECT COUNT(*) as count FROM tickets
    `;

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      totalTickets: parseInt(result.count) || 0,
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
