// Simple Vercel Serverless Function for testing
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET /api/health
  if (req.method === 'GET' && path === '/api/health') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'sagitine-ai-cx-agent',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        env_test: process.env.ANTHROPIC_API_KEY ? 'API_KEY_EXISTS' : 'NO_API_KEY',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // POST /api/classify
  if (req.method === 'POST' && path === '/api/classify') {
    try {
      const rawBody = await req.json();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            category_primary: 'damaged_missing_faulty',
            confidence: 0.85,
            urgency: 9,
            risk_level: 'high',
            customer_intent_summary: 'Test classification successful',
            recommended_next_action: 'Test action',
            safe_to_auto_draft: false,
            safe_to_auto_send: false,
          },
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Not found' }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
