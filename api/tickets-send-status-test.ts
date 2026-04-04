// Minimal test endpoint
export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('TEST ENDPOINT CALLED');
  console.log('Method:', req.method);
  console.log('Query:', req.query);
  console.log('Body:', req.body);

  return res.status(200).json({
    success: true,
    message: 'Test endpoint working',
    method: req.method,
    query: req.query,
    body: req.body,
    timestamp: new Date().toISOString(),
  });
}
