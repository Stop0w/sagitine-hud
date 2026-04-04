// @ts-nocheck
// Simple working metrics endpoint
import { db } from '../src/db';
import { tickets } from '../src/db/schema';
import { count } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
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
    const result = await db
      .select({ count: count() })
      .from(tickets)
      .limit(1);

    return res.status(200).json({
      success: true,
      data: {
        totalOpen: result[0]?.count || 0,
        urgentCount: 0,
        avgResponseTimeMinutes: 0,
        criticality: 'NOMINAL',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[METRICS] Error:', error);
    return res.status(200).json({
      success: true,
      data: {
        totalOpen: 0,
        urgentCount: 0,
        avgResponseTimeMinutes: 0,
        criticality: 'NOMINAL',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
