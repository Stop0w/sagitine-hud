const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = 'postgresql://neondb_owner:npg_DcMVKN6u4lTx@ep-dawn-lake-a7mgk9ex-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);

async function checkDatabase() {
  try {
    console.log('=== Connecting to Neon Database ===\n');

    // Check row counts
    const [inboundResult, profilesResult, triageResult, ticketsResult] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM inbound_emails`,
      sql`SELECT COUNT(*) as count FROM customer_profiles`,
      sql`SELECT COUNT(*) as count FROM triage_results`,
      sql`SELECT COUNT(*) as count FROM tickets`,
    ]);

    console.log('=== Database Row Counts ===');
    console.log(`inbound_emails: ${inboundResult[0].count}`);
    console.log(`customer_profiles: ${profilesResult[0].count}`);
    console.log(`triage_results: ${triageResult[0].count}`);
    console.log(`tickets: ${ticketsResult[0].count}`);

    // Check for hayden@sagitine.com specifically
    const haydenProfile = await sql`
      SELECT * FROM customer_profiles
      WHERE email = 'hayden@sagitine.com'
      LIMIT 1
    `;

    console.log('\n=== Profile for hayden@sagitine.com ===');
    if (haydenProfile.length > 0) {
      console.log(JSON.stringify(haydenProfile[0], null, 2));
    } else {
      console.log('✓ No profile found for hayden@sagitine.com');
      console.log('\nThis is EXPECTED - the system is new and has not processed any real emails yet.');
    }

    // Show what a customer profile WILL contain
    console.log('\n=== What a Customer Profile WILL Contain (based on schema) ===');
    console.log({
      // === Core Identity ===
      email: 'customer@example.com',
      name: 'Customer Name (optional)',
      phone: '+61 400 000 000 (optional)',

      // === Contact Preferences ===
      preferredContactChannel: 'email | phone | instagram | facebook | shopify | manual',
      lastContactChannel: 'email | phone | instagram | facebook | shopify | manual',

      // === Contact Timeline ===
      firstContactAt: '2026-01-01T00:00:00.000Z',
      lastContactAt: '2026-04-02T11:00:00.000Z',
      totalContactCount: 5,
      totalEmailCount: 3,

      // === Last Interaction Context ===
      lastContactCategory: 'shipping_delivery_order_issue | damaged_missing_faulty | etc.',
      lastContactOutcome: 'resolved | pending | escalated',

      // === Issue Category Counts ===
      damagedIssueCount: 1,
      deliveryIssueCount: 2,
      usageGuidanceCount: 0,
      prePurchaseCount: 1,
      returnRefundCount: 0,
      stockQuestionCount: 0,
      praiseUgcCount: 1,

      // === Lifetime Metrics ===
      lifetimeIssueCount: 3,
      lifetimePositiveFeedbackCount: 1,

      // === Customer Flags ===
      isRepeatContact: true,
      isHighAttentionCustomer: false,
      sentimentLastKnown: 'neutral | positive | negative',

      // === Social Commerce ===
      instagramHandle: '@customerhandle',
      facebookProfile: 'facebook.com/customer',
      shopifyCustomerId: 'shop_1234567890',
      shopifyOrderCount: 2,
      shopifyLtv: '250.00',
      lastOrderAt: '2026-03-15T00:00:00.000Z',

      // === Internal Notes ===
      notesInternal: 'VIP customer - prefers email contact',
    });

    console.log('\n=== What Contact Facts WILL Contain (Recent History) ===');
    console.log([{
      channel: 'email | phone | instagram | facebook | shopify | manual',
      direction: 'inbound | outbound',
      contactAt: '2026-04-02T11:00:00.000Z',
      category: 'shipping_delivery_order_issue | damaged_missing_faulty | etc.',
      sentiment: 'frustrated | neutral | positive',
      urgency: 9,
      riskLevel: 'low | medium | high',
      status: 'resolved | pending | escalated',
      resolutionType: 'replacement_sent | refund_issued | guidance_provided',
      wasHumanReviewed: true,
      wasCustomerHappy: true,
      responseTimeMinutes: 45,
      orderNumber: 'SAG-12345',
      hadOrderReference: true,
      hadDamageClaim: false,
      hadDeliveryIssue: true,
      hadRefundRequest: false,
      hadPositiveFeedback: false,
      summary: 'Customer reported delayed package - replacement sent',
    }]);

    console.log('\n=== Left-Hand Column UI Display ===');
    console.log('Based on the customer profile, the UI will show:');
    console.log('1. Customer name & email (top)');
    console.log('2. Contact timeline (first contact → last contact)');
    console.log('3. Lifetime metrics (total contacts, orders, LTV)');
    console.log('4. Issue breakdown (damage X, delivery Y, returns Z)');
    console.log('5. Customer flags (repeat contact? high attention?)');
    console.log('6. Social links (Instagram, Facebook, Shopify)');
    console.log('7. Recent contact history (last 5-10 interactions)');
    console.log('8. Internal notes (if any)');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDatabase();
