// @ts-nocheck
// Metrics API endpoint for Sagitine AI CX Agent

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  console.log('[METRICS] Function invoked with NO imports');

  try {
    // Try requiring drizzle dynamically
    console.log('[METRICS] Attempting dynamic import of drizzle...');
    const drizzle = await import('drizzle-orm');
    console.log('[METRICS] Drizzle imported:', !!drizzle);

    // Try requiring db dynamically
    console.log('[METRICS] Attempting dynamic import of db...');
    const dbModule = await import('../src/db/index.js');
    console.log('[METRICS] DB module imported:', !!dbModule);
    const db = dbModule.db;
    console.log('[METRICS] db available:', !!db);

    return res.status(200).json({
      success: true,
      data: {
        total_queue: 0,
        urgent_count: 0,
        sent_today: 0,
        pending_review: 0,
        approved: 0,
        rejected: 0,
        queue: [],
        _timezone: 'Australia/Sydney',
        _debug: 'dynamic_imports_work'
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[METRICS] Error:', error);
    console.error('[METRICS] Error stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
    });
  }
}
