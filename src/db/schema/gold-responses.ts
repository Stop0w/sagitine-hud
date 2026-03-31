/**
 * Gold Response Templates
 *
 * Reusable response templates for RAG system.
 * Generated from Appendix B backfill pipeline.
 */

import { pgEnum, pgTable, uuid, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

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
]);

export const goldResponses = pgTable('gold_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  category: goldCategoryEnum('category').notNull(),
  bodyTemplate: text('body_template').notNull(),
  toneNotes: text('tone_notes'),
  isActive: boolean('is_active').notNull().default(true),
  useCount: integer('use_count').notNull().default(0),
  avgWordCount: integer('avg_word_count'), // From backfill metrics
  avgParagraphCount: integer('avg_paragraph_count'), // From backfill metrics
  sampleCount: integer('sample_count'), // Number of emails analyzed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type GoldResponse = typeof goldResponses.$inferSelect;
export type NewGoldResponse = typeof goldResponses.$inferInsert;
