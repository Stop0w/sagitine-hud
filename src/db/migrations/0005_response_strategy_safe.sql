-- Response Strategy Layer - Safe Migration (Data Loss Prevention)
-- Phase 1: Add schema changes (nullable for existing data)

-- Create response_action enum
CREATE TYPE "public"."response_action" AS ENUM('provide_information', 'arrange_replacement', 'process_refund', 'escalate', 'request_info', 'decline_request', 'acknowledge_feedback', 'route_to_team');

-- Create response_strategies table
CREATE TABLE "response_strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"summary" text,
	"recommended_action" text NOT NULL,
	"action_type" "response_action" NOT NULL,
	"matched_template_id" uuid,
	"matched_template_confidence" integer,
	"drivers" jsonb DEFAULT '[]'::jsonb,
	"rationale" text,
	"draft_tone" text DEFAULT 'warm_professional' NOT NULL,
	"must_include" jsonb DEFAULT '[]'::jsonb,
	"must_avoid" jsonb DEFAULT '[]'::jsonb,
	"customer_context" jsonb DEFAULT '{}'::jsonb,
	"strategy_source" text DEFAULT 'deterministic' NOT NULL,
	"generated_by" text DEFAULT 'response_strategy_service' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "response_strategies" ADD CONSTRAINT "response_strategies_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "response_strategies" ADD CONSTRAINT "response_strategies_matched_template_id_gold_responses_id_fk" FOREIGN KEY ("matched_template_id") REFERENCES "public"."gold_responses"("id") ON DELETE no action ON UPDATE no action;

-- Add columns to gold_responses (nullable initially for safe migration)
ALTER TABLE "gold_responses" ADD COLUMN "action_type" "response_action";
ALTER TABLE "gold_responses" ADD COLUMN "appropriate_urgency_min" integer;
ALTER TABLE "gold_responses" ADD COLUMN "appropriate_urgency_max" integer;
ALTER TABLE "gold_responses" ADD COLUMN "appropriate_risk_levels" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "gold_responses" ADD COLUMN "must_include" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "gold_responses" ADD COLUMN "must_avoid" jsonb DEFAULT '[]'::jsonb;

-- Phase 2: Backfill action_type based on category (safe default mapping)
UPDATE "gold_responses" SET "action_type" = CASE category
  WHEN 'damaged_missing_faulty' THEN 'arrange_replacement'
  WHEN 'shipping_delivery_order_issue' THEN 'provide_information'
  WHEN 'product_usage_guidance' THEN 'provide_information'
  WHEN 'pre_purchase_question' THEN 'provide_information'
  WHEN 'return_refund_exchange' THEN 'process_refund'
  WHEN 'stock_availability' THEN 'provide_information'
  WHEN 'partnership_wholesale_press' THEN 'route_to_team'
  WHEN 'brand_feedback_general' THEN 'acknowledge_feedback'
  WHEN 'spam_solicitation' THEN 'decline_request'
  WHEN 'account_billing_payment' THEN 'provide_information'
  WHEN 'order_modification_cancellation' THEN 'request_info'
  WHEN 'praise_testimonial_ugc' THEN 'acknowledge_feedback'
  WHEN 'other_uncategorized' THEN 'request_info'
END;

-- Phase 3: Now make action_type NOT NULL (after backfill)
ALTER TABLE "gold_responses" ALTER COLUMN "action_type" SET NOT NULL;
