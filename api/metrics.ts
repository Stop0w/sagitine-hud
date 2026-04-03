// @ts-nocheck
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
    },
    timestamp: new Date().toISOString(),
    test: true
  });
}
