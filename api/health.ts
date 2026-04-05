// Simple Node.js serverless function for health check
export default async function handler(req: any, res: any) {
  return res.status(200).json({
    status: 'ok',
    service: 'sagitine-ai-cx-agent',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
