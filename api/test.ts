// Minimal test endpoint
export default async function handler(req, res) {
  return res.status(200).json({
    test: 'working',
    timestamp: new Date().toISOString(),
    path: req.url,
  });
}
