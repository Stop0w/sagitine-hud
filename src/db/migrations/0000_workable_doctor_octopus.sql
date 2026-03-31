CREATE TYPE "public"."gold_category" AS ENUM('damaged_missing_faulty', 'shipping_delivery_order_issue', 'product_usage_guidance', 'pre_purchase_question', 'return_refund_exchange', 'stock_availability', 'partnership_wholesale_press', 'brand_feedback_general');--> statement-breakpoint
CREATE TYPE "public"."snippet_category" AS ENUM('damaged_missing_faulty', 'shipping_delivery_order_issue', 'product_usage_guidance', 'pre_purchase_question', 'return_refund_exchange', 'stock_availability', 'partnership_wholesale_press', 'brand_feedback_general');--> statement-breakpoint
CREATE TYPE "public"."snippet_type" AS ENUM('policy', 'fact', 'guidance');--> statement-breakpoint
CREATE TABLE "gold_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"category" "gold_category" NOT NULL,
	"body_template" text NOT NULL,
	"tone_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"avg_word_count" integer,
	"avg_paragraph_count" integer,
	"sample_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_snippets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "snippet_type" NOT NULL,
	"category" "snippet_category" NOT NULL,
	"content" text NOT NULL,
	"tags" jsonb,
	"source" varchar(255) DEFAULT 'backfill_pipeline' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
