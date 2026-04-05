// Minimal test endpoint
export default async function handler(req: any, res: any) {
  return res.status(200).json({
    test: 'working',
    timestamp: new Date().toISOString(),
    path: req.url,
  });
}
