// Apply migration for response strategy layer
const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const migrationSQL = `
-- Step 1: Create response_action enum
DO $$ BEGIN
  CREATE TYPE response_action AS ENUM (
    'provide_information',
    'arrange_replacement',
    'process_refund',
    'escalate',
    'request_info',
    'decline_request',
    'acknowledge_feedback',
    'route_to_team'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create response_strategies table
CREATE TABLE IF NOT EXISTS response_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  summary text,
  recommended_action text NOT NULL,
  action_type response_action NOT NULL,
  matched_template_id uuid,
  matched_template_confidence integer,
  drivers jsonb DEFAULT '[]'::jsonb,
  rationale text,
  draft_tone text DEFAULT 'warm_professional' NOT NULL,
  must_include jsonb DEFAULT '[]'::jsonb,
  must_avoid jsonb DEFAULT '[]'::jsonb,
  customer_context jsonb DEFAULT '{}'::jsonb,
  strategy_source text DEFAULT 'deterministic' NOT NULL,
  generated_by text DEFAULT 'response_strategy_service' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT response_strategies_ticket_id_tickets_id_fk
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT response_strategies_matched_template_id_gold_responses_id_fk
    FOREIGN KEY (matched_template_id) REFERENCES gold_responses(id)
    ON DELETE no action ON UPDATE no action
);

-- Step 3: Add columns to gold_responses (nullable first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_responses' AND column_name = 'action_type'
  ) THEN
    ALTER TABLE gold_responses ADD COLUMN action_type response_action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_responses' AND column_name = 'appropriate_urgency_min'
  ) THEN
    ALTER TABLE gold_responses ADD COLUMN appropriate_urgency_min integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_responses' AND column_name = 'appropriate_urgency_max'
  ) THEN
    ALTER TABLE gold_responses ADD COLUMN appropriate_urgency_max integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_responses' AND column_name = 'appropriate_risk_levels'
  ) THEN
    ALTER TABLE gold_responses ADD COLUMN appropriate_risk_levels jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_responses' AND column_name = 'must_include'
  ) THEN
    ALTER TABLE gold_responses ADD COLUMN must_include jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_responses' AND column_name = 'must_avoid'
  ) THEN
    ALTER TABLE gold_responses ADD COLUMN must_avoid jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Step 4: Backfill action_type based on category
UPDATE gold_responses
SET action_type = CASE category
  WHEN 'damaged_missing_faulty' THEN 'arrange_replacement'::response_action
  WHEN 'shipping_delivery_order_issue' THEN 'provide_information'::response_action
  WHEN 'product_usage_guidance' THEN 'provide_information'::response_action
  WHEN 'pre_purchase_question' THEN 'provide_information'::response_action
  WHEN 'return_refund_exchange' THEN 'process_refund'::response_action
  WHEN 'stock_availability' THEN 'provide_information'::response_action
  WHEN 'partnership_wholesale_press' THEN 'route_to_team'::response_action
  WHEN 'brand_feedback_general' THEN 'acknowledge_feedback'::response_action
  WHEN 'spam_solicitation' THEN 'decline_request'::response_action
  WHEN 'account_billing_payment' THEN 'provide_information'::response_action
  WHEN 'order_modification_cancellation' THEN 'request_info'::response_action
  WHEN 'praise_testimonial_ugc' THEN 'acknowledge_feedback'::response_action
  WHEN 'other_uncategorized' THEN 'request_info'::response_action
END
WHERE action_type IS NULL;

-- Step 5: Make action_type NOT NULL (after backfill)
DO $$
BEGIN
  ALTER TABLE gold_responses ALTER COLUMN action_type SET NOT NULL;
EXCEPTION
  WHEN others THEN null;
END $$;
`;

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    console.log('Applying migration...');
    await client.query(migrationSQL);
    console.log('✓ Migration applied successfully\n');

    // Verify migration
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('response_strategies', 'gold_responses')
      ORDER BY table_name
    `);

    console.log('Schema verification:');
    console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));

    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'gold_responses'
      AND column_name IN ('action_type', 'must_include', 'must_avoid', 'appropriate_urgency_min', 'appropriate_urgency_max', 'appropriate_risk_levels')
      ORDER BY column_name
    `);

    console.log('New columns:', columns.rows.map(r => r.column_name).join(', '));

    const enums = await client.query(`
      SELECT typname FROM pg_type WHERE typname = 'response_action'
    `);

    console.log('Enums:', enums.rows.length > 0 ? 'response_action' : '(none)');

    await client.end();
  } catch (error) {
    console.error('Migration failed:', error.message);
    await client.end();
    process.exit(1);
  }
}

applyMigration();
