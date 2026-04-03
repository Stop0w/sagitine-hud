// API Server Entry Point
// Run locally with: npx tsx api-server.ts

import { serve } from '@hono/node-server';
import { api } from './src/api/index';

const port = parseInt(process.env.API_PORT || '3001', 10);

console.log(`🚀 Sagitine AI CX Agent API Server`);
console.log(`📡 Listening on http://localhost:${port}`);
console.log(`📚 Endpoints:`);
console.log(`   POST /api/classify - Classify inbound email`);
console.log(`   GET  /api/health   - Health check`);
console.log(`   GET  /api/categories - List categories`);
console.log(`\n⏳ Ready to classify emails...\n`);

serve({
  fetch: api.fetch,
  port,
});
