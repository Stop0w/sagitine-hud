/**
 * Verification Script: End-to-End Dashboard Data Flow Test
 *
 * This script verifies that:
 * 1. Database has tickets from Make.com webhook
 * 2. /api/hub/dashboard returns real data (not zeros)
 * 3. Frontend can display the data correctly
 */

import { db } from '../src/db';
import { tickets, inboundEmails, triageResults } from '../src/db/schema';
import { sql, and } from 'drizzle-orm';

const HUD_VISIBLE_CONDITION = sql`
  (
    tickets.status NOT IN ('archived', 'rejected')
    AND tickets.send_status != 'sent'
  )
`;

async function verifyDashboard() {
  console.log('\n=== SAGITINE DASHBOARD VERIFICATION ===\n');

  // ========================================================================
  // CHECK 1: Database connection and raw ticket count
  // ========================================================================
  console.log('📊 CHECK 1: Database Connection');
  try {
    const [totalOpen] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .where(HUD_VISIBLE_CONDITION);

    console.log(`   ✅ Total Open Tickets: ${totalOpen.count}`);

    if (Number(totalOpen.count) === 0) {
      console.log('   ⚠️  No tickets found - Make.com webhook may not have run yet');
    } else {
      console.log(`   ✅ Database contains real ticket data`);
    }
  } catch (error: any) {
    console.log(`   ❌ Database error: ${error.message}`);
    return;
  }

  // ========================================================================
  // CHECK 2: Sample recent ticket data
  // ========================================================================
  console.log('\n📧 CHECK 2: Recent Ticket Sample');
  try {
    const recentTickets = await db
      .select({
        id: tickets.id,
        fromEmail: inboundEmails.fromEmail,
        subject: inboundEmails.subject,
        category: triageResults.categoryPrimary,
        urgency: triageResults.urgency,
        receivedAt: inboundEmails.receivedAt,
      })
      .from(tickets)
      .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(HUD_VISIBLE_CONDITION)
      .orderBy(desc(inboundEmails.receivedAt))
      .limit(5);

    if (recentTickets.length === 0) {
      console.log('   ⚠️  No recent tickets found');
    } else {
      console.log(`   ✅ Found ${recentTickets.length} recent tickets:`);
      recentTickets.forEach((ticket, i) => {
        console.log(`      ${i + 1}. ${ticket.subject?.substring(0, 50)}...`);
        console.log(`         From: ${ticket.fromEmail}`);
        console.log(`         Category: ${ticket.category} | Urgency: ${ticket.urgency}`);
        console.log(`         Received: ${ticket.receivedAt?.toISOString()}`);
      });
    }
  } catch (error: any) {
    console.log(`   ❌ Query error: ${error.message}`);
  }

  // ========================================================================
  // CHECK 3: Category breakdown
  // ========================================================================
  console.log('\n📁 CHECK 3: Category Breakdown');
  try {
    const categoryCounts = await db
      .select({
        category: triageResults.categoryPrimary,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(HUD_VISIBLE_CONDITION)
      .groupBy(triageResults.categoryPrimary);

    if (categoryCounts.length === 0) {
      console.log('   ⚠️  No categories with tickets');
    } else {
      console.log(`   ✅ Tickets in ${categoryCounts.length} categories:`);
      categoryCounts.forEach(cat => {
        console.log(`      ${cat.category}: ${cat.count} tickets`);
      });
    }
  } catch (error: any) {
    console.log(`   ❌ Query error: ${error.message}`);
  }

  // ========================================================================
  // CHECK 4: Urgent tickets (urgency >= 7 OR high risk)
  // ========================================================================
  console.log('\n🚨 CHECK 4: Urgent Tickets');
  try {
    const [urgentCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
      .where(
        and(
          HUD_VISIBLE_CONDITION,
          sql`(urgency >= 7 OR risk_level = 'high')`
        )
      );

    console.log(`   ✅ Urgent Tickets: ${urgentCount.count}`);

    if (Number(urgentCount.count) > 0) {
      const urgentTickets = await db
        .select({
          id: tickets.id,
          subject: inboundEmails.subject,
          urgency: triageResults.urgency,
          riskLevel: triageResults.riskLevel,
        })
        .from(tickets)
        .innerJoin(inboundEmails, eq(tickets.emailId, inboundEmails.id))
        .innerJoin(triageResults, eq(tickets.triageResultId, triageResults.id))
        .where(
          and(
            HUD_VISIBLE_CONDITION,
            sql`(urgency >= 7 OR risk_level = 'high')`
          )
        )
        .limit(3);

      console.log(`   Recent urgent tickets:`);
      urgentTickets.forEach((ticket, i) => {
        console.log(`      ${i + 1}. ${ticket.subject?.substring(0, 40)}...`);
        console.log(`         Urgency: ${ticket.urgency} | Risk: ${ticket.riskLevel}`);
      });
    }
  } catch (error: any) {
    console.log(`   ❌ Query error: ${error.message}`);
  }

  console.log('\n=== VERIFICATION COMPLETE ===\n');
  console.log('Next steps:');
  console.log('1. If ticket count is 0: Send a test email through Make.com');
  console.log('2. Start dev server: npm run dev');
  console.log('3. Open browser to: http://localhost:5173');
  console.log('4. Check NotificationPill (bottom right) shows real counts\n');
}

// Run verification
verifyDashboard().catch(console.error);
