// Test environment variables
export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request) {
  try {
    return new Response(
      JSON.stringify({
        success: true,
        env_check: {
          database_url_set: !!process.env.DATABASE_URL,
          database_url_prefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
          database_url_length: process.env.DATABASE_URL?.length,
          node_env: process.env.NODE_ENV,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
