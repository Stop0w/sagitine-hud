/**
 * Gold Response Templates
 *
 * Reusable response templates for RAG system.
 * Generated from Appendix B backfill pipeline.
 */

import { pgEnum, pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

// Canonical category IDs (must match Appendix B outputs)
export const goldCategoryEnum = pgEnum('gold_category', [
  'damaged_missing_faulty',
  'shipping_delivery_order_issue',
  'product_usage_guidance',
  'pre_purchase_question',
  'return_refund_exchange',
  'stock_availability',
  'partnership_wholesale_press',
  'brand_feedback_general',
  // Expanded operational and functional categories
  'spam_solicitation',
  'account_billing_payment',
  'order_modification_cancellation',
  'praise_testimonial_ugc',
  'other_uncategorized',
]);

// Response action types (what this template enables operationally)
export const responseActionEnum = pgEnum('response_action', [
  'provide_information',
  'arrange_replacement',
  'process_refund',
  'escalate',
  'request_info',
  'decline_request',
  'acknowledge_feedback',
  'route_to_team',
]);

export const goldResponses = pgTable('gold_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  category: goldCategoryEnum('category').notNull(),
  actionType: responseActionEnum('action_type').notNull(),
  bodyTemplate: text('body_template').notNull(),
  toneNotes: text('tone_notes'),
  // Response strategy metadata
  appropriateUrgencyMin: integer('appropriate_urgency_min'), // Minimum urgency threshold
  appropriateUrgencyMax: integer('appropriate_urgency_max'), // Maximum urgency threshold
  appropriateRiskLevels: jsonb('appropriate_risk_levels').$type<string[]>().default([]),
  mustInclude: jsonb('must_include').$type<string[]>().default([]), // Required content elements
  mustAvoid: jsonb('must_avoid').$type<string[]>().default([]), // Prohibited content elements
  // Usage tracking
  isActive: boolean('is_active').notNull().default(true),
  useCount: integer('use_count').notNull().default(0),
  avgWordCount: integer('avg_word_count'), // From backfill metrics
  avgParagraphCount: integer('avg_paragraph_count'), // From backfill metrics
  sampleCount: integer('sample_count'), // Number of emails analyzed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * response_strategies
 *
 * Explicit strategy objects for each ticket.
 * Bridges deterministic analysis → draft generation.
 */
export const responseStrategies = pgTable('response_strategies', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => require('./index').tickets.id, { onDelete: 'cascade' }),
  // Strategy core
  summary: text('summary'), // AI-synthesized or template-derived
  recommendedAction: text('recommended_action').notNull(),
  actionType: responseActionEnum('action_type').notNull(),
  // Template matching
  matchedTemplateId: uuid('matched_template_id').references(() => goldResponses.id),
  matchedTemplateConfidence: integer('matched_template_confidence'), // 0-100
  // Strategy drivers (why this strategy was selected)
  drivers: jsonb('drivers').$type<string[]>().default([]),
  rationale: text('rationale'), // Explanation of strategy selection
  // Draft generation constraints
  draftTone: text('draft_tone').notNull().default('warm_professional'),
  mustInclude: jsonb('must_include').$type<string[]>().default([]),
  mustAvoid: jsonb('must_avoid').$type<string[]>().default([]),
  customerContext: jsonb('customer_context').$type<Record<string, any>>().default({}),
  // Management escalation guardrail (pre-launch safety)
  requiresManagementApproval: boolean('requires_management_approval').notNull().default(false),
  managementEscalationReason: text('management_escalation_reason'), // Reason for escalation if flagged
  // Audit
  strategySource: text('strategy_source').notNull().default('deterministic'), // 'deterministic' | 'llm_assisted'
  generatedBy: text('generated_by').notNull().default('response_strategy_service'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type GoldResponse = typeof goldResponses.$inferSelect;
export type NewGoldResponse = typeof goldResponses.$inferInsert;
export type ResponseStrategy = typeof responseStrategies.$inferSelect;
export type NewResponseStrategy = typeof responseStrategies.$inferInsert;
