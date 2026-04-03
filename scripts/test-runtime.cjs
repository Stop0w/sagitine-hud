// Test classification → strategy → draft runtime
const fetch = require('node-fetch');

async function testRuntime() {
  const payload = {
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
  };

  console.log('Sending test classification request...\n');

  const response = await fetch('http://localhost:3000/api/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (result.success) {
    console.log('✓ Classification successful\n');
    console.log(`Email ID: ${result.email_id}`);
    console.log(`Triage Result ID: ${result.triage_result_id}`);
    console.log(`Ticket ID: ${result.ticket_id}`);
    console.log(`Customer Profile ID: ${result.customer_profile_id}\n`);

    // Now fetch the hydration payload to verify strategy
    console.log('Fetching hydration payload...\n');
    const hydration = await fetch(`http://localhost:3000/api/hub/ticket/${result.ticket_id}`);
    const hydrationData = await hydration.json();

    if (hydrationData.success && hydrationData.data.strategy) {
      const s = hydrationData.data.strategy;
      console.log('✓ Strategy generated and persisted\n');
      console.log(`Action Type: ${s.actionType}`);
      console.log(`Template Label: ${s.matchedTemplateLabel}`);
      console.log(`Template Confidence: ${s.matchedTemplateConfidence}%`);
      console.log(`Recommended Action: ${s.recommendedAction}`);
      console.log(`Summary: ${s.summary}\n`);
      console.log(`Drivers (${s.drivers.length}):`);
      s.drivers.slice(0, 3).forEach(d => console.log(`  - ${d}`));
      console.log(`\nMust Include (${s.mustInclude.length}):`);
      s.mustInclude.forEach(i => console.log(`  - ${i}`));
      console.log(`\nMust Avoid (${s.mustAvoid.length}):`);
      s.mustAvoid.forEach(a => console.log(`  - ${a}`));

      console.log(`\nDraft Response (first 3 lines):\n${hydrationData.data.triage.draftResponse.split('\n').slice(0, 3).join('\n')}`);
    } else {
      console.log('✗ Strategy not found in hydration payload');
      console.log('Available keys:', Object.keys(hydrationData.data));
    }
  } else {
    console.log('✗ Classification failed:', result.error);
  }
}

testRuntime().catch(console.error);
