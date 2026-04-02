// Minimal test endpoint
export default async function handler(req: Request) {
  return new Response(JSON.stringify({
    test: 'working',
    timestamp: new Date().toISOString(),
    path: new URL(req.url).pathname,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
