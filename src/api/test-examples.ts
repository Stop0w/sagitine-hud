// Test Examples for API Classification
// These are example payloads and expected responses for testing

import type { InboundEmailPayload, ClassificationAPIResponse } from './types.js';

/**
 * Example 1: Damaged Item (High urgency, medium risk)
 */
export const TEST_PAYLOAD_DAMAGED: InboundEmailPayload = {
  from_email: 'sarah.johnson@example.com',
  from_name: 'Sarah Johnson',
  subject: 'Re: Order #438325301 - Damaged box received',
  body_plain: `Hi Heidi,

I just received my Florence 8-Box Stand in Black today and unfortunately one of the boxes arrived with a dent in the side. The box still works but it's quite noticeable.

I've attached a photo showing the damage. Could you please let me know how to get a replacement?

Thank you,
Sarah`,
  timestamp: '2026-03-31T10:30:00Z',
  message_id: '<AM0PR02MB123456789012345678901234@MSGID>',
  thread_id: '<AM0PR02MB123456789012345678901234@MSGID>',
};

export const EXPECTED_RESPONSE_DAMAGED: ClassificationAPIResponse = {
  success: true,
  data: {
    category_primary: 'damaged_missing_faulty',
    category_secondary: undefined,
    confidence: 0.92,
    urgency: 9,
    risk_level: 'medium',
    risk_flags: [],
    customer_intent_summary: 'Customer received a damaged box and is requesting a replacement',
    recommended_next_action: 'Request photo evidence and arrange replacement shipment',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: ['uuid-1', 'uuid-2'],
    reply_subject: 'Re: Order #438325301 - Damaged box received',
    reply_body: `Hi [Customer Name],

Thank you for letting me know about this issue.
Thank you for bringing this to my attention.

I understand that your [Box Name] has arrived [issue description].

We take great care in packaging our products, and occasionally issues can occur during transit.
We'll resolve this for you immediately.

Please provide a photo of the damage, and we'll arrange a replacement to be shipped within [timeframe].
You don't need to return the original item.

Warm regards,
Heidi x`,
  },
  timestamp: '2026-03-31T10:30:05Z',
};

/**
 * Example 2: Shipping Inquiry (Medium urgency, low risk)
 */
export const TEST_PAYLOAD_SHIPPING: InboundEmailPayload = {
  from_email: 'michael.chen@example.com',
  from_name: 'Michael Chen',
  subject: 'When will my order ship?',
  body_plain: `Hi,

I placed an order for a Milan 3-Box Stand last week (order #438325450) and haven't received any shipping confirmation yet.

Can you let me know when it's expected to ship? I'm hoping to receive it by next Friday if possible.

Thanks,
Michael`,
  timestamp: '2026-03-31T11:15:00Z',
};

export const EXPECTED_RESPONSE_SHIPPING: ClassificationAPIResponse = {
  success: true,
  data: {
    category_primary: 'shipping_delivery_order_issue',
    confidence: 0.88,
    urgency: 7,
    risk_level: 'low',
    risk_flags: [],
    customer_intent_summary: 'Customer is inquiring about order status and expected shipping date',
    recommended_next_action: 'Provide shipping status and expected delivery timeframe',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: ['uuid-3', 'uuid-4'],
    reply_subject: 'Re: When will my order ship?',
    reply_body: `Hi [Customer Name],

Thank you for reaching out about your order.

I'm writing to provide an update on your delivery status.

Your [Box Name] is currently [status].

Expected delivery: [timeframe].

You'll receive a tracking notification once your order has been dispatched.

If you have any questions about your delivery, please don't hesitate to ask.

Kind regards,
Heidi x`,
  },
  timestamp: '2026-03-31T11:15:05Z',
};

/**
 * Example 3: Product Usage (Low urgency, low risk)
 */
export const TEST_PAYLOAD_USAGE: InboundEmailPayload = {
  from_email: 'emma.williams@example.com',
  from_name: 'Emma Williams',
  subject: 'How do I open the boxes?',
  body_plain: `Hi there,

I just received my first Sagitine stand and I love it! However, I'm finding the boxes quite hard to open - they feel quite tight.

Is there a trick to opening them more easily? I feel like I might be doing it wrong.

Thanks for your help!
Emma`,
  timestamp: '2026-03-31T12:00:00Z',
};

export const EXPECTED_RESPONSE_USAGE: ClassificationAPIResponse = {
  success: true,
  data: {
    category_primary: 'product_usage_guidance',
    confidence: 0.95,
    urgency: 5,
    risk_level: 'low',
    risk_flags: [],
    customer_intent_summary: 'Customer is asking for guidance on how to properly open and use the boxes',
    recommended_next_action: 'Provide usage guidance and explain the design intent',
    safe_to_auto_draft: true,
    safe_to_auto_send: true,
    retrieved_knowledge_ids: ['uuid-5', 'uuid-6', 'uuid-7'],
    reply_subject: 'Re: How do I open the boxes?',
    reply_body: `Hi [Customer Name],

Thank you so much for your message.

The first thing to note is that the Sagitine Boxes are designed as storage boxes, not drawers. They sit within the frame rather than on runners, which allows you to remove, reorganise, and protect your pieces more effectively over time.

Because of this, they are intentionally a more considered interaction. Many customers find it becomes very natural quite quickly, particularly when using two hands to open the Boxes.

I hope that context is helpful, and of course please reach out if you have any other questions.

Warm regards,
Heidi x`,
  },
  timestamp: '2026-03-31T12:00:05Z',
};

/**
 * Example 4: Partnership Request (Low urgency, high risk)
 */
export const TEST_PAYLOAD_PARTNERSHIP: InboundEmailPayload = {
  from_email: 'influencer@agency.com',
  from_name: 'Creative Agency',
  subject: 'Collaboration Opportunity with Popular Fashion Influencer',
  body_plain: `Hi Sagitine Team,

We represent a fashion influencer with 250k+ followers who loves your brand. We're interested in discussing a potential collaboration for an upcoming campaign.

Would you be open to a partnership discussion? We have a media kit available to share.

Looking forward to hearing from you!

Best regards,
Creative Agency Team`,
  timestamp: '2026-03-31T13:30:00Z',
};

export const EXPECTED_RESPONSE_PARTNERSHIP: ClassificationAPIResponse = {
  success: true,
  data: {
    category_primary: 'partnership_wholesale_press',
    confidence: 0.85,
    urgency: 3,
    risk_level: 'high',
    risk_flags: ['business_decision_required', 'partnership_evaluation'],
    customer_intent_summary: 'Agency is proposing a partnership/collaboration with an influencer',
    recommended_next_action: 'Review partnership proposal and decline or accept based on current strategy',
    safe_to_auto_draft: true,
    safe_to_auto_send: false,
    retrieved_knowledge_ids: ['uuid-8'],
    reply_subject: 'Re: Collaboration Opportunity with Popular Fashion Influencer',
    reply_body: `Hi [Customer Name],

Thank you so much for reaching out — I really appreciate you thinking of Sagitine.

At the moment, we're being quite selective with partnerships and focusing on a smaller number of very aligned collaborations, so we won't be moving forward this time.

That said, I'd absolutely love to stay in touch for future opportunities.

Warm regards,
Heidi x`,
  },
  timestamp: '2026-03-31T13:30:05Z',
};

/**
 * Test runner script
 */
export async function runTest(payload: InboundEmailPayload): Promise<void> {
  console.log('Testing API classification...');
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('http://localhost:3000/api/classify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result: ClassificationAPIResponse = await response.json();

    console.log('\nResponse:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      console.log('\n✅ Classification successful!');
      console.log(`Category: ${result.data.category_primary}`);
      console.log(`Confidence: ${(result.data.confidence * 100).toFixed(1)}%`);
      console.log(`Urgency: ${result.data.urgency}/10`);
      console.log(`Risk: ${result.data.risk_level}`);
      console.log(`Safe to auto-send: ${result.data.safe_to_auto_send}`);
    } else {
      console.log('\n❌ Classification failed:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Test error:', error);
  }
}
