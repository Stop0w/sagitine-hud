-- Response Strategy Layer - Safe Migration (Data Loss Prevention)
-- Phase 1: Add schema changes (nullable for existing data)

-- Create response_action enum
CREATE TYPE "public"."response_action" AS ENUM('provide_information', 'arrange_replacement', 'process_refund', 'escalate', 'request_info', 'decline_request', 'acknowledge_feedback', 'route_to_team');--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "gold_responses" ADD COLUMN "action_type" "response_action";--> statement-breakpoint
ALTER TABLE "gold_responses" ADD COLUMN "appropriate_urgency_min" integer;--> statement-breakpoint
ALTER TABLE "gold_responses" ADD COLUMN "appropriate_urgency_max" integer;--> statement-breakpoint
ALTER TABLE "gold_responses" ADD COLUMN "appropriate_risk_levels" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "gold_responses" ADD COLUMN "must_include" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "gold_responses" ADD COLUMN "must_avoid" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
-- Backfill action_type based on category
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
END;--> statement-breakpoint
ALTER TABLE "gold_responses" ALTER COLUMN "action_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "response_strategies" ADD CONSTRAINT "response_strategies_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_strategies" ADD CONSTRAINT "response_strategies_matched_template_id_gold_responses_id_fk" FOREIGN KEY ("matched_template_id") REFERENCES "public"."gold_responses"("id") ON DELETE no action ON UPDATE no action;
