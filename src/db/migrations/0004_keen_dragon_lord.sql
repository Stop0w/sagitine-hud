CREATE TABLE "draft_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"input_draft" text NOT NULL,
	"corrected_draft" text,
	"changes_detected" boolean DEFAULT false NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proof_status" text DEFAULT 'proofed' NOT NULL,
	"operator_edited" boolean DEFAULT false NOT NULL,
	"proof_model" text DEFAULT 'claude-haiku' NOT NULL,
	"proofed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "send_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"initial_draft" text NOT NULL,
	"final_message_sent" text NOT NULL,
	"confidence_rating" numeric(4, 3) NOT NULL,
	"was_human_edited" boolean DEFAULT false NOT NULL,
	"was_proofed" boolean DEFAULT false NOT NULL,
	"resolution_mechanism" text NOT NULL,
	"proof_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draft_proofs" ADD CONSTRAINT "draft_proofs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_audit" ADD CONSTRAINT "send_audit_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_audit" ADD CONSTRAINT "send_audit_proof_id_draft_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."draft_proofs"("id") ON DELETE no action ON UPDATE no action;