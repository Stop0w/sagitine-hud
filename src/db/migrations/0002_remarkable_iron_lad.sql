CREATE TYPE "public"."contact_channel" AS ENUM('email', 'phone', 'instagram', 'facebook', 'shopify', 'manual');--> statement-breakpoint
CREATE TYPE "public"."contact_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TABLE "customer_contact_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_profile_id" uuid NOT NULL,
	"ticket_id" uuid,
	"email_id" uuid,
	"channel" "contact_channel" NOT NULL,
	"direction" "contact_direction" NOT NULL,
	"contact_at" timestamp with time zone NOT NULL,
	"category" "category",
	"sentiment" text,
	"urgency" integer,
	"risk_level" "risk_level",
	"status" text,
	"resolution_type" text,
	"was_human_reviewed" boolean DEFAULT false NOT NULL,
	"was_customer_happy" boolean,
	"response_time_minutes" integer,
	"order_number" text,
	"had_order_reference" boolean DEFAULT false NOT NULL,
	"had_damage_claim" boolean DEFAULT false NOT NULL,
	"had_delivery_issue" boolean DEFAULT false NOT NULL,
	"had_refund_request" boolean DEFAULT false NOT NULL,
	"had_positive_feedback" boolean DEFAULT false NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"preferred_contact_channel" "contact_channel",
	"first_contact_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"total_contact_count" integer DEFAULT 0 NOT NULL,
	"total_email_count" integer DEFAULT 0 NOT NULL,
	"last_contact_category" "category",
	"last_contact_outcome" text,
	"damaged_issue_count" integer DEFAULT 0 NOT NULL,
	"delivery_issue_count" integer DEFAULT 0 NOT NULL,
	"usage_guidance_count" integer DEFAULT 0 NOT NULL,
	"pre_purchase_count" integer DEFAULT 0 NOT NULL,
	"return_refund_count" integer DEFAULT 0 NOT NULL,
	"stock_question_count" integer DEFAULT 0 NOT NULL,
	"praise_ugc_count" integer DEFAULT 0 NOT NULL,
	"lifetime_issue_count" integer DEFAULT 0 NOT NULL,
	"lifetime_positive_feedback_count" integer DEFAULT 0 NOT NULL,
	"is_repeat_contact" boolean DEFAULT false NOT NULL,
	"is_high_attention_customer" boolean DEFAULT false NOT NULL,
	"sentiment_last_known" text,
	"instagram_handle" text,
	"facebook_profile" text,
	"shopify_customer_id" text,
	"shopify_order_count" integer,
	"shopify_ltv" numeric(10, 2),
	"last_order_at" timestamp with time zone,
	"notes_internal" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "customer_contact_facts" ADD CONSTRAINT "customer_contact_facts_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contact_facts" ADD CONSTRAINT "customer_contact_facts_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contact_facts" ADD CONSTRAINT "customer_contact_facts_email_id_inbound_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."inbound_emails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_profiles_email_idx" ON "customer_profiles" USING btree ("email");