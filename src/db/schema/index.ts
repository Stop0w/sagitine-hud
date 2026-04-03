// ============================================================================
// CORE TABLES
// ============================================================================

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

export const categoryEnum = pgEnum('category', [
  'damaged_missing_faulty',
  'shipping_delivery_order_issue',
  'product_usage_guidance',
  'pre_purchase_question',
  'return_refund_exchange',
  'stock_availability',
  'partnership_wholesale_press',
  'brand_feedback_general',
  'spam_solicitation',
  'other_uncategorized',
  'account_billing_payment',
  'order_modification_cancellation',
  'praise_testimonial_ugc',
]);

export const riskLevelEnum = pgEnum('risk_level', [
  'low',
  'medium',
  'high',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'new',
  'classified',
  'approved',
  'rejected',
  'archived',
]);

export const sendStatusEnum = pgEnum('send_status', [
  'not_applicable',
  'pending',
  'sent',
  'failed',
]);

// ============================================================================
// TABLES
// ============================================================================

/**
 * inbound_emails
 *
 * Raw source-of-truth for every inbound email.
 * Stored before any AI classification happens.
 */
export const inboundEmails = pgTable('inbound_emails', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceMessageId: text('source_message_id'),
  sourceThreadId: text('source_thread_id'),
  fromEmail: text('from_email').notNull(),
  fromName: text('from_name'),
  subject: text('subject').notNull(),
  bodyPlain: text('body_plain').notNull(),
  bodyHtml: text('body_html'),
  sourceSystem: text('source_system').notNull().default('outlook'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sourceMessageIdx: uniqueIndex('inbound_emails_source_message_id_idx').on(table.sourceMessageId),
}));

/**
 * triage_results
 *
 * AI classification, scoring, and draft generation.
 * Linked to inbound_email via email_id.
 */
export const triageResults = pgTable('triage_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailId: uuid('email_id').notNull().references(() => inboundEmails.id, { onDelete: 'cascade' }),
  categoryPrimary: categoryEnum('category_primary').notNull(),
  confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
  urgency: integer('urgency').notNull(),
  riskLevel: riskLevelEnum('risk_level').notNull(),
  riskFlags: jsonb('risk_flags').$type<string[]>().default([]).notNull(),
  customerIntentSummary: text('customer_intent_summary'),
  recommendedNextAction: text('recommended_next_action'),
  safeToAutoDraft: boolean('safe_to_auto_draft').notNull().default(true),
  safeToAutoSend: boolean('safe_to_auto_send').notNull().default(false),
  replySubject: text('reply_subject'),
  replyBody: text('reply_body'),
  retrievedKnowledgeIds: jsonb('retrieved_knowledge_ids').$type<string[]>().default([]).notNull(),
  classifierVersion: text('classifier_version'),
  isMock: boolean('is_mock').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * tickets
 *
 * Operational workflow state for the HUD.
 * Separates workflow status from AI classification output.
 */
export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailId: uuid('email_id').notNull().references(() => inboundEmails.id, { onDelete: 'cascade' }),
  triageResultId: uuid('triage_result_id').notNull().references(() => triageResults.id, { onDelete: 'cascade' }),
  status: ticketStatusEnum('status').notNull().default('classified'),
  sendStatus: sendStatusEnum('send_status').notNull().default('not_applicable'),
  assignedTo: text('assigned_to'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sendAttemptedAt: timestamp('send_attempted_at', { withTimezone: true }),
  sendFailedAt: timestamp('send_failed_at', { withTimezone: true }),
  sendFailureReason: text('send_failure_reason'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedBy: text('rejected_by'),
  rejectionReason: text('rejection_reason'),
  humanEdited: boolean('human_edited').notNull().default(false),
  humanEditedBody: text('human_edited_body'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// CUSTOMER SERVICE PROFILES
// ============================================================================

export const contactChannelEnum = pgEnum('contact_channel', [
  'email',
  'phone',
  'instagram',
  'facebook',
  'shopify',
  'manual',
]);

export const contactDirectionEnum = pgEnum('contact_direction', [
  'inbound',
  'outbound',
]);

/**
 * customer_profiles
 *
 * Summary layer for customer service context and history.
 * One row per identifiable customer (email-based identity).
 */
export const customerProfiles = pgTable('customer_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  phone: text('phone'),
  preferredContactChannel: contactChannelEnum('preferred_contact_channel'),
  lastContactChannel: contactChannelEnum('last_contact_channel'),
  firstContactAt: timestamp('first_contact_at', { withTimezone: true }),
  lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
  totalContactCount: integer('total_contact_count').notNull().default(0),
  totalEmailCount: integer('total_email_count').notNull().default(0),
  lastContactCategory: categoryEnum('last_contact_category'),
  lastContactOutcome: text('last_contact_outcome'),
  damagedIssueCount: integer('damaged_issue_count').notNull().default(0),
  deliveryIssueCount: integer('delivery_issue_count').notNull().default(0),
  usageGuidanceCount: integer('usage_guidance_count').notNull().default(0),
  prePurchaseCount: integer('pre_purchase_count').notNull().default(0),
  returnRefundCount: integer('return_refund_count').notNull().default(0),
  stockQuestionCount: integer('stock_question_count').notNull().default(0),
  praiseUgcCount: integer('praise_ugc_count').notNull().default(0),
  lifetimeIssueCount: integer('lifetime_issue_count').notNull().default(0),
  lifetimePositiveFeedbackCount: integer('lifetime_positive_feedback_count').notNull().default(0),
  isRepeatContact: boolean('is_repeat_contact').notNull().default(false),
  isHighAttentionCustomer: boolean('is_high_attention_customer').notNull().default(false),
  sentimentLastKnown: text('sentiment_last_known'),
  instagramHandle: text('instagram_handle'),
  facebookProfile: text('facebook_profile'),
  shopifyCustomerId: text('shopify_customer_id'),
  shopifyOrderCount: integer('shopify_order_count'),
  shopifyLtv: numeric('shopify_ltv', { precision: 10, scale: 2 }),
  lastOrderAt: timestamp('last_order_at', { withTimezone: true }),
  notesInternal: text('notes_internal'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('customer_profiles_email_idx').on(table.email),
}));

/**
 * customer_contact_facts
 *
 * Lightweight event/contact ledger.
 * One row per contact or interaction.
 * Supports rollups into customer_profiles.
 */
export const customerContactFacts = pgTable('customer_contact_facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerProfileId: uuid('customer_profile_id').notNull().references(() => customerProfiles.id, { onDelete: 'cascade' }),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  emailId: uuid('email_id').references(() => inboundEmails.id, { onDelete: 'set null' }),
  channel: contactChannelEnum('channel').notNull(),
  direction: contactDirectionEnum('direction').notNull(),
  contactAt: timestamp('contact_at', { withTimezone: true }).notNull(),
  category: categoryEnum('category'),
  sentiment: text('sentiment'),
  urgency: integer('urgency'),
  riskLevel: riskLevelEnum('risk_level'),
  status: text('status'),
  resolutionType: text('resolution_type'),
  wasHumanReviewed: boolean('was_human_reviewed').notNull().default(false),
  wasCustomerHappy: boolean('was_customer_happy'),
  responseTimeMinutes: integer('response_time_minutes'),
  orderNumber: text('order_number'),
  hadOrderReference: boolean('had_order_reference').notNull().default(false),
  hadDamageClaim: boolean('had_damage_claim').notNull().default(false),
  hadDeliveryIssue: boolean('had_delivery_issue').notNull().default(false),
  hadRefundRequest: boolean('had_refund_request').notNull().default(false),
  hadPositiveFeedback: boolean('had_positive_feedback').notNull().default(false),
  summary: text('summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * draft_proofs
 *
 * Audit trail for draft proofing using Claude Haiku.
 * Records every proof request for AI quality analysis.
 */
export const draftProofs = pgTable('draft_proofs', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  inputDraft: text('input_draft').notNull(),
  correctedDraft: text('corrected_draft'),
  changesDetected: boolean('changes_detected').notNull().default(false),
  suggestions: jsonb('suggestions').$type<ProofSuggestion[]>().default([]).notNull(),
  proofStatus: text('proof_status').notNull().default('proofed'), // 'proofed' | 'warning' | 'error'
  operatorEdited: boolean('operator_edited').notNull().default(false),
  proofModel: text('proof_model').notNull().default('claude-haiku'),
  proofedAt: timestamp('proofed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Proof suggestion type for structured feedback
 */
export type ProofSuggestion = {
  type: 'grammar' | 'tone' | 'clarity' | 'spelling' | 'risk' | 'duplication';
  severity: 'low' | 'medium' | 'high';
  message: string;
  original?: string;
  correction?: string;
};

/**
 * send_audit
 *
 * Complete audit trail for sent messages.
 * Tracks initial AI draft vs final sent message for AI efficacy analysis.
 */
export const sendAudit = pgTable('send_audit', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  initialDraft: text('initial_draft').notNull(),
  finalMessageSent: text('final_message_sent').notNull(),
  confidenceRating: numeric('confidence_rating', { precision: 4, scale: 3 }).notNull(),
  wasHumanEdited: boolean('was_human_edited').notNull().default(false),
  wasProofed: boolean('was_proofed').notNull().default(false),
  resolutionMechanism: text('resolution_mechanism').notNull(), // 'ai_drafted' | 'human_edited' | 'human_proofed'
  proofId: uuid('proof_id').references(() => draftProofs.id),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// TYPES
// ============================================================================

export type InboundEmail = typeof inboundEmails.$inferSelect;
export type NewInboundEmail = typeof inboundEmails.$inferInsert;

export type TriageResult = typeof triageResults.$inferSelect;
export type NewTriageResult = typeof triageResults.$inferInsert;

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;

export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type NewCustomerProfile = typeof customerProfiles.$inferInsert;

export type CustomerContactFact = typeof customerContactFacts.$inferSelect;
export type NewCustomerContactFact = typeof customerContactFacts.$inferInsert;

export type DraftProof = typeof draftProofs.$inferSelect;
export type NewDraftProof = typeof draftProofs.$inferInsert;

export type SendAudit = typeof sendAudit.$inferSelect;
export type NewSendAudit = typeof sendAudit.$inferInsert;

// ============================================================================
// RE-EXPORT KNOWLEDGE BASE TABLES
// ============================================================================

export * from './gold-responses';
export * from './knowledge-snippets';
