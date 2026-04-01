/**
 * Knowledge Snippets
 *
 * Policy, fact, and guidance objects for RAG system.
 * Generated from Appendix B backfill pipeline.
 */

import { pgEnum, pgTable, uuid, varchar, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

// Canonical category IDs (must match Appendix B outputs)
export const snippetCategoryEnum = pgEnum('snippet_category', [
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

// Snippet types from Appendix B
export const snippetTypeEnum = pgEnum('snippet_type', [
  'policy',
  'fact',
  'guidance',
]);

export const knowledgeSnippets = pgTable('knowledge_snippets', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  type: snippetTypeEnum('type').notNull(),
  category: snippetCategoryEnum('category').notNull(),
  content: text('content').notNull(),
  tags: jsonb('tags').$type<string[]>(), // Array of tag strings
  source: varchar('source', { length: 255 }).notNull().default('backfill_pipeline'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type KnowledgeSnippet = typeof knowledgeSnippets.$inferSelect;
export type NewKnowledgeSnippet = typeof knowledgeSnippets.$inferInsert;
