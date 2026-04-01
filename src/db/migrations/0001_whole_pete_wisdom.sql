CREATE TYPE "public"."category" AS ENUM('damaged_missing_faulty', 'shipping_delivery_order_issue', 'product_usage_guidance', 'pre_purchase_question', 'return_refund_exchange', 'stock_availability', 'partnership_wholesale_press', 'brand_feedback_general', 'spam_solicitation', 'other_uncategorized', 'account_billing_payment', 'order_modification_cancellation', 'praise_testimonial_ugc');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."send_status" AS ENUM('not_applicable', 'pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('new', 'classified', 'approved', 'rejected', 'archived');--> statement-breakpoint
ALTER TYPE "public"."gold_category" ADD VALUE 'spam_solicitation';--> statement-breakpoint
ALTER TYPE "public"."gold_category" ADD VALUE 'account_billing_payment';--> statement-breakpoint
ALTER TYPE "public"."gold_category" ADD VALUE 'order_modification_cancellation';--> statement-breakpoint
ALTER TYPE "public"."gold_category" ADD VALUE 'praise_testimonial_ugc';--> statement-breakpoint
ALTER TYPE "public"."gold_category" ADD VALUE 'other_uncategorized';--> statement-breakpoint
ALTER TYPE "public"."snippet_category" ADD VALUE 'spam_solicitation';--> statement-breakpoint
ALTER TYPE "public"."snippet_category" ADD VALUE 'account_billing_payment';--> statement-breakpoint
ALTER TYPE "public"."snippet_category" ADD VALUE 'order_modification_cancellation';--> statement-breakpoint
ALTER TYPE "public"."snippet_category" ADD VALUE 'praise_testimonial_ugc';--> statement-breakpoint
ALTER TYPE "public"."snippet_category" ADD VALUE 'other_uncategorized';--> statement-breakpoint
CREATE TABLE "inbound_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_message_id" text,
	"source_thread_id" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"subject" text NOT NULL,
	"body_plain" text NOT NULL,
	"body_html" text,
	"source_system" text DEFAULT 'outlook' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"triage_result_id" uuid NOT NULL,
	"status" "ticket_status" DEFAULT 'classified' NOT NULL,
	"send_status" "send_status" DEFAULT 'not_applicable' NOT NULL,
	"assigned_to" text,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"sent_at" timestamp with time zone,
	"send_attempted_at" timestamp with time zone,
	"send_failed_at" timestamp with time zone,
	"send_failure_reason" text,
	"rejected_at" timestamp with time zone,
	"rejected_by" text,
	"rejection_reason" text,
	"human_edited" boolean DEFAULT false NOT NULL,
	"human_edited_body" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triage_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"category_primary" "category" NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"urgency" integer NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"customer_intent_summary" text,
	"recommended_next_action" text,
	"safe_to_auto_draft" boolean DEFAULT true NOT NULL,
	"safe_to_auto_send" boolean DEFAULT false NOT NULL,
	"reply_subject" text,
	"reply_body" text,
	"retrieved_knowledge_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classifier_version" text,
	"is_mock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_email_id_inbound_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."inbound_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_triage_result_id_triage_results_id_fk" FOREIGN KEY ("triage_result_id") REFERENCES "public"."triage_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_results" ADD CONSTRAINT "triage_results_email_id_inbound_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."inbound_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_emails_source_message_id_idx" ON "inbound_emails" USING btree ("source_message_id");