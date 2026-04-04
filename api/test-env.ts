import type { VercelRequest, VercelResponse } from '@vercel/node';

export async function GET(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    has_database_url: !!process.env.DATABASE_URL,
    database_url_prefix: process.env.DATABASE_URL?.substring(0, 30) || 'NOT SET',
    node_env: process.env.NODE_ENV,
  });
}
