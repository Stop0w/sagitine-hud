// Direct test of classification → strategy → draft
require('dotenv').config({ path: '.env' });

// Simulate Next.js req/res objects
const mockReq = {
  method: 'POST',
  body: {
    from_email: 'test.customer@example.com',
    from_name: 'Test Customer',
    subject: 'Damaged Box received - Order #99999',
    body_plain: `Hi,

I received my order today but unfortunately the Box arrived damaged. The corner is completely crushed and the contents are exposed.

I've attached photos showing the damage. Can you please help with this?

Thanks,
Test Customer`,
    body_html: '<p>Hi,</p><p>I received my order today but unfortunately the Box arrived damaged...</p>',
    timestamp: new Date().toISOString(),
    message_id: `test-${Date.now()}@example.com`,
    thread_id: `thread-${Date.now()}@example.com`,
  },
};

let mockResData = null;
const mockRes = {
  status(code) {
    return {
      json(data) {
        mockResData = { statusCode: code, ...data };
      },
    };
  },
  setHeader() {},
  end() {},
};

async function runTest() {
  console.log('Testing classification → strategy → draft pipeline...\n');

  // Import the handler
  const handler = require('../api/classify.ts').default;

  // Run classification
  await handler(mockReq, mockRes);

  if (mockResData && mockResData.success) {
    console.log('✓ Classification successful\n');
    console.log(`Email ID: ${mockResData.email_id}`);
    console.log(`Triage Result ID: ${mockResData.triage_result_id}`);
    console.log(`Ticket ID: ${mockResData.ticket_id}`);
    console.log(`Customer Profile ID: ${mockResData.customer_profile_id}\n`);

    // Now verify the strategy was created and persisted
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    await client.connect();

    // Check response_strategies table
    const strategyResult = await client.query(`
      SELECT
        ticket_id,
        action_type,
        matched_template_confidence,
        recommended_action,
        summary,
        drivers,
        must_include,
        must_avoid
      FROM response_strategies
      WHERE ticket_id = $1
    `, [mockResData.ticket_id]);

    if (strategyResult.rows.length > 0) {
      const s = strategyResult.rows[0];
      console.log('✓ Strategy persisted to response_strategies\n');
      console.log(`Action Type: ${s.action_type}`);
      console.log(`Template Confidence: ${s.matched_template_confidence}%`);
      console.log(`Recommended Action: ${s.recommended_action}`);
      console.log(`Summary: ${s.summary}\n`);
      console.log(`Drivers (${s.drivers.length}):`);
      s.drivers.slice(0, 3).forEach(d => console.log(`  - ${d}`));
      console.log(`\nMust Include (${s.must_include.length}):`);
      s.must_include.forEach(i => console.log(`  - ${i}`));
      console.log(`\nMust Avoid (${s.must_avoid.length}):`);
      s.must_avoid.forEach(a => console.log(`  - ${a}`));
    } else {
      console.log('✗ Strategy NOT found in response_strategies table');
    }

    // Check triage_results was updated with strategy fields
    const triageResult = await client.query(`
      SELECT
        reply_body,
        customer_intent_summary,
        recommended_next_action
      FROM triage_results
      WHERE id = $1
    `, [mockResData.triage_result_id]);

    if (triageResult.rows.length > 0) {
      const t = triageResult.rows[0];
      console.log('\n✓ triage_results updated with strategy fields\n');
      console.log(`customer_intent_summary: ${t.customer_intent_summary}`);
      console.log(`recommended_next_action: ${t.recommended_next_action}`);
      console.log(`\nDraft Response (first 3 lines):\n${t.reply_body.split('\n').slice(0, 3).join('\n')}`);
    }

    await client.end();
  } else {
    console.log('✗ Classification failed');
    console.log(mockResData);
  }
}

runTest().catch(console.error);
