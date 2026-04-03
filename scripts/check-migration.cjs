// Check and apply migration if needed
const { drizzle } = require('drizzle-orm/node-postgres');
const pg = require('pg');
const { sql } = require('drizzle-orm');

require('dotenv').config({ path: '.env.local' });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkAndApplyMigration() {
  await client.connect();

  console.log('Checking schema...\n');

  // Check if response_strategies table exists
  const tablesCheck = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('response_strategies', 'gold_responses')
    ORDER BY table_name;
  `);

  console.log('Existing tables:');
  tablesCheck.rows.forEach(row => {
    console.log(`  - ${row.table_name}`);
  });

  // Check gold_responses columns
  const columnsCheck = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'gold_responses'
    AND column_name IN ('action_type', 'must_include', 'must_avoid', 'appropriate_urgency_min', 'appropriate_urgency_max', 'appropriate_risk_levels')
    ORDER BY column_name;
  `);

  console.log('\ngold_responses columns:');
  if (columnsCheck.rows.length === 0) {
    console.log('  (no response strategy columns found)');
  } else {
    columnsCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
  }

  // Check if response_action enum exists
  const enumCheck = await client.query(`
    SELECT typname
    FROM pg_type
    WHERE typname = 'response_action'
  `);

  console.log('\nEnums:');
  if (enumCheck.rows.length === 0) {
    console.log('  response_action: NOT FOUND');
  } else {
    console.log('  response_action: EXISTS');
  }

  await client.end();
}

checkAndApplyMigration().catch(console.error);
