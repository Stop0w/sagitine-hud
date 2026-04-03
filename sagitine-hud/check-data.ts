import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, count } from 'drizzle-orm';
import * as schema from './src/db/schema/index';
import { config } from 'dotenv';

config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function checkAllTables() {
  const [inboundCount, profileCount, triageCount, ticketCount] = await Promise.all([
    db.select({ count: count() }).from(schema.inboundEmails),
    db.select({ count: count() }).from(schema.customerProfiles),
    db.select({ count: count() }).from(schema.triageResults),
    db.select({ count: count() }).from(schema.tickets),
  ]);

  console.log('=== Database Row Counts ===');
  console.log(`inbound_emails: ${inboundCount[0].count}`);
  console.log(`customer_profiles: ${profileCount[0].count}`);
  console.log(`triage_results: ${triageCount[0].count}`);
  console.log(`tickets: ${ticketCount[0].count}`);

  // Sample any existing profiles to show the structure
  if (profileCount[0].count > 0) {
    const profiles = await db.select().from(schema.customerProfiles).limit(3);
    console.log('\n=== Sample Customer Profiles ===');
    console.log(JSON.stringify(profiles, null, 2));
  } else {
    console.log('\n=== What a Customer Profile Will Contain (based on schema) ===');
    console.log({
      email: 'customer@example.com',
      name: 'Customer Name',
      phone: '+61 400 000 000',
      preferredContactChannel: 'email | phone | instagram | facebook | shopify | manual',
      lastContactChannel: 'email | phone | instagram | facebook | shopify | manual',
      firstContactAt: '2026-01-01T00:00:00.000Z',
      lastContactAt: '2026-04-02T11:00:00.000Z',
      totalContactCount: 5,
      totalEmailCount: 3,
      lastContactCategory: 'shipping_delivery_order_issue',
      lastContactOutcome: 'resolved',
      damagedIssueCount: 1,
      deliveryIssueCount: 2,
      usageGuidanceCount: 0,
      prePurchaseCount: 1,
      returnRefundCount: 0,
      stockQuestionCount: 0,
      praiseUgcCount: 1,
      lifetimeIssueCount: 3,
      lifetimePositiveFeedbackCount: 1,
      isRepeatContact: true,
      isHighAttentionCustomer: false,
      sentimentLastKnown: 'neutral',
      instagramHandle: '@customerhandle',
      facebookProfile: 'facebook.com/customer',
      shopifyCustomerId: 'shop_1234567890',
      shopifyOrderCount: 2,
      shopifyLtv: '250.00',
      lastOrderAt: '2026-03-15T00:00:00.000Z',
      notesInternal: 'VIP customer - prefers email contact',
    });
  }

  // Sample any existing contact facts
  if (profileCount[0].count > 0) {
    const facts = await db.select().from(schema.customerContactFacts).limit(5);
    console.log('\n=== Sample Contact Facts (Recent History) ===');
    console.log(JSON.stringify(facts, null, 2));
  } else {
    console.log('\n=== What Contact Facts Will Contain (based on schema) ===');
    console.log([{
      channel: 'email',
      direction: 'inbound',
      contactAt: '2026-04-02T11:00:00.000Z',
      category: 'shipping_delivery_order_issue',
      sentiment: 'frustrated',
      urgency: 9,
      riskLevel: 'medium',
      status: 'resolved',
      resolutionType: 'replacement_sent',
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
  }
}

checkAllTables().catch(console.error);
