export default async function handler(req: any, res: any) {
  return res.status(200).json({
    has_database_url: !!process.env.DATABASE_URL,
    database_url_prefix: process.env.DATABASE_URL?.substring(0, 30) || 'NOT SET',
    has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    anthropic_key_prefix: process.env.ANTHROPIC_API_KEY?.substring(0, 14) || 'NOT SET',
    node_env: process.env.NODE_ENV,
  });
}
