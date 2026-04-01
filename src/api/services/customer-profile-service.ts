// Customer Profile Service
// Lightweight customer service profile management for Sagitine AI CX Agent
import { db } from '../../db';
import { customerProfiles, customerContactFacts, tickets, inboundEmails } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { CanonicalCategory, RiskLevel } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface ProfileRollupData {
  category: CanonicalCategory;
  urgency: number;
  riskLevel: RiskLevel;
  hadPositiveFeedback?: boolean;
}

export interface InboundContactFactData {
  customerProfileId: string;
  ticketId: string;
  emailId: string;
  category: CanonicalCategory;
  urgency: number;
  riskLevel: RiskLevel;
  customerIntentSummary: string;
}

export interface OutboundContactFactData {
  customerProfileId: string;
  ticketId: string;
  responseTimeMinutes?: number;
  wasCustomerHappy?: boolean;
}

// ============================================================================
// FIND OR CREATE PROFILE
// ============================================================================

/**
 * Find existing customer profile by email, or create new one
 * Returns profile ID for use in contact fact creation
 */
export async function findOrCreateProfile(
  email: string,
  name?: string
): Promise<{ id: string; isNew: boolean }> {
  try {
    // Try to find existing profile
    const [existing] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.email, email))
      .limit(1);

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    // Create new profile
    const [newProfile] = await db
      .insert(customerProfiles)
      .values({
        email,
        name,
        firstContactAt: new Date(),
        lastContactAt: new Date(),
        totalContactCount: 0,
        totalEmailCount: 0,
        isRepeatContact: false,
        isHighAttentionCustomer: false,
      })
      .returning();

    return { id: newProfile.id, isNew: true };
  } catch (error) {
    console.error('Error in findOrCreateProfile:', error);
    throw error;
  }
}

// ============================================================================
// RECORD INBOUND CONTACT FACT
// ============================================================================

/**
 * Create a customer contact fact for inbound email interaction
 * Should be called AFTER classification is complete
 */
export async function recordInboundContactFact(
  data: InboundContactFactData
): Promise<string> {
  try {
    const [fact] = await db
      .insert(customerContactFacts)
      .values({
        customerProfileId: data.customerProfileId,
        ticketId: data.ticketId,
        emailId: data.emailId,
        channel: 'email',
        direction: 'inbound',
        contactAt: new Date(),
        category: data.category,
        urgency: data.urgency,
        riskLevel: data.riskLevel,
        summary: data.customerIntentSummary,
        // Category-specific flags
        hadDamageClaim: data.category === 'damaged_missing_faulty',
        hadDeliveryIssue: data.category === 'shipping_delivery_order_issue',
        hadRefundRequest: data.category === 'return_refund_exchange',
        hadPositiveFeedback: data.category === 'praise_testimonial_ugc',
      })
      .returning();

    return fact.id;
  } catch (error) {
    console.error('Error in recordInboundContactFact:', error);
    throw error;
  }
}

// ============================================================================
// RECORD OUTBOUND CONTACT FACT
// ============================================================================

/**
 * Create a customer contact fact for outbound response
 * Should be called when Make.com confirms send success
 */
export async function recordOutboundContactFact(
  data: OutboundContactFactData
): Promise<string> {
  try {
    // Get the ticket's associated data to populate fact
    const [ticketData] = await db
      .select({
        emailId: tickets.emailId,
        triageResultId: tickets.triageResultId,
      })
      .from(tickets)
      .where(eq(tickets.id, data.ticketId))
      .limit(1);

    if (!ticketData) {
      throw new Error('Ticket not found for outbound contact fact');
    }

    const [fact] = await db
      .insert(customerContactFacts)
      .values({
        customerProfileId: data.customerProfileId,
        ticketId: data.ticketId,
        emailId: ticketData.emailId,
        channel: 'email',
        direction: 'outbound',
        contactAt: new Date(),
        responseTimeMinutes: data.responseTimeMinutes,
        wasCustomerHappy: data.wasCustomerHappy,
        status: 'sent',
      })
      .returning();

    return fact.id;
  } catch (error) {
    console.error('Error in recordOutboundContactFact:', error);
    throw error;
  }
}

// ============================================================================
// UPDATE PROFILE ROLLUPS
// ============================================================================

/**
 * Update customer profile rollup fields using atomic increments
 * Called after creating contact fact
 */
export async function updateProfileRollups(
  profileId: string,
  data: ProfileRollupData
): Promise<void> {
  try {
    // Build update object based on category
    const updateData: any = {
      lastContactAt: new Date(),
      totalContactCount: sql`total_contact_count + 1`,
      totalEmailCount: sql`total_email_count + 1`,
      lastContactCategory: data.category,
      updated_at: new Date(),
    };

    // Category-specific counters
    switch (data.category) {
      case 'damaged_missing_faulty':
        updateData.damagedIssueCount = sql`damaged_issue_count + 1`;
        updateData.lifetimeIssueCount = sql`lifetime_issue_count + 1`;
        break;
      case 'shipping_delivery_order_issue':
        updateData.deliveryIssueCount = sql`delivery_issue_count + 1`;
        updateData.lifetimeIssueCount = sql`lifetime_issue_count + 1`;
        break;
      case 'product_usage_guidance':
        updateData.usageGuidanceCount = sql`usage_guidance_count + 1`;
        break;
      case 'pre_purchase_question':
        updateData.prePurchaseCount = sql`pre_purchase_count + 1`;
        break;
      case 'return_refund_exchange':
        updateData.returnRefundCount = sql`return_refund_count + 1`;
        updateData.lifetimeIssueCount = sql`lifetime_issue_count + 1`;
        break;
      case 'stock_availability':
        updateData.stockQuestionCount = sql`stock_question_count + 1`;
        break;
      case 'praise_testimonial_ugc':
        updateData.praiseUgcCount = sql`praise_ugc_count + 1`;
        updateData.lifetimePositiveFeedbackCount = sql`lifetime_positive_feedback_count + 1`;
        break;
      case 'account_billing_payment':
        updateData.lifetimeIssueCount = sql`lifetime_issue_count + 1`;
        break;
      case 'order_modification_cancellation':
        updateData.lifetimeIssueCount = sql`lifetime_issue_count + 1`;
        break;
      default:
        // Generic categories don't need specific counters
        break;
    }

    // Update is_repeat_contact if total_contact_count will become >= 2
    const [currentProfile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.id, profileId))
      .limit(1);

    if (currentProfile && currentProfile.totalContactCount >= 1) {
      updateData.isRepeatContact = true;
    }

    // Update is_high_attention_customer based on automated rules
    // Rule: lifetime_issue_count >= 3 OR total_contact_count >= 4
    const newIssueCount = (currentProfile?.lifetimeIssueCount || 0) +
      (data.category === 'damaged_missing_faulty' ||
       data.category === 'shipping_delivery_order_issue' ||
       data.category === 'return_refund_exchange' ||
       data.category === 'account_billing_payment' ||
       data.category === 'order_modification_cancellation' ? 1 : 0);

    const newContactCount = (currentProfile?.totalContactCount || 0) + 1;

    if (newIssueCount >= 3 || newContactCount >= 4) {
      updateData.isHighAttentionCustomer = true;
    }

    // Execute update
    await db
      .update(customerProfiles)
      .set(updateData)
      .where(eq(customerProfiles.id, profileId));
  } catch (error) {
    console.error('Error in updateProfileRollups:', error);
    throw error;
  }
}

// ============================================================================
// UPDATE OUTBOUND ACTIVITY
// ============================================================================

/**
 * Update customer profile after outbound send
 * Does NOT increment counters - only updates latest activity fields
 */
export async function updateOutboundActivity(
  profileId: string,
  sentAt: Date
): Promise<void> {
  try {
    await db
      .update(customerProfiles)
      .set({
        lastContactAt: sentAt,
        lastContactOutcome: 'sent',
        updated_at: new Date(),
      })
      .where(eq(customerProfiles.id, profileId));
  } catch (error) {
    console.error('Error in updateOutboundActivity:', error);
    throw error;
  }
}
