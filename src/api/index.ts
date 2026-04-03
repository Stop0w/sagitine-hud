// API Routes for Sagitine AI CX Agent
// Serverless API endpoint for email classification

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { classifyEmail } from './services/claude-classifier.js';
import type { InboundEmailPayload, ClassificationAPIResponse } from './types.js';

// Initialize Hono app
const app = new Hono();

// Configure CORS for Make.com webhook
app.use('/*', cors({
  origin: ['https://www.make.com', 'https://make.com'],
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Request schema validation
const inboundEmailSchema = z.object({
  from_email: z.string().email(),
  from_name: z.string().optional(),
  subject: z.string().min(1),
  body_plain: z.string().min(1),
  body_html: z.string().optional(),
  timestamp: z.string(),
  message_id: z.string().optional(),
  thread_id: z.string().optional(),
  in_reply_to: z.string().optional(),
  references: z.array(z.string()).optional(),
});

/**
 * POST /api/classify
 * Classify inbound email and generate draft response
 */
app.post('/api/classify', async (c) => {
  try {
    // Parse and validate request body
    const rawBody = await c.req.json();
    const validationResult = inboundEmailSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map((issue: any) => issue.message).join(', ');
      return c.json<ClassificationAPIResponse>({
        success: false,
        error: `Validation error: ${errorDetails}`,
        timestamp: new Date().toISOString(),
      }, 400);
    }

    const payload: InboundEmailPayload = validationResult.data;

    // Classify email
    const result = await classifyEmail(payload);

    // Return successful classification
    return c.json<ClassificationAPIResponse>({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('API error:', error);

    return c.json<ClassificationAPIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'sagitine-ai-cx-agent',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/categories
 * List available canonical categories
 */
app.get('/api/categories', (c) => {
  return c.json({
    categories: [
      { id: 'damaged_missing_faulty', label: 'Damaged/Missing/Faulty', urgency_default: 10 },
      { id: 'shipping_delivery_order_issue', label: 'Shipping/Delivery', urgency_default: 9 },
      { id: 'product_usage_guidance', label: 'Product Usage', urgency_default: 8 },
      { id: 'pre_purchase_question', label: 'Pre-Purchase', urgency_default: 7 },
      { id: 'return_refund_exchange', label: 'Return/Refund/Exchange', urgency_default: 9 },
      { id: 'stock_availability', label: 'Stock Availability', urgency_default: 6 },
      { id: 'partnership_wholesale_press', label: 'Partnership/Press', urgency_default: 3 },
      { id: 'brand_feedback_general', label: 'Brand Feedback', urgency_default: 2 },
    ],
  });
});

// Export for Vercel serverless deployment
export default app;
