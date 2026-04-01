/**
 * Management Escalation Guardrail Migration
 *
 * Pre-launch safety patch: Adds management approval fields to response_strategies table
 *
 * Fields added:
 * - requires_management_approval (boolean, default false)
 * - management_escalation_reason (text, nullable)
 *
 * Run: npx tsx migrations/add-management-escalation-fields.ts
 */

import 'dotenv/config';
import { db } from '../src/db';
import { responseStrategies } from '../src/db/schema/gold-responses';
import { sql } from 'drizzle-orm';

async function up() {
  console.log('🔒 Adding management escalation guardrail fields to response_strategies table...');

  try {
    // Check if columns already exist
    const tableInfo = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'response_strategies'
      AND column_name IN ('requires_management_approval', 'management_escalation_reason')
    `);

    const existingColumns = tableInfo.rows.map(row => row.column_name);

    if (existingColumns.length >= 2) {
      console.log('✅ Fields already exist - skipping migration');
      return;
    }

    // Add requires_management_approval column
    if (!existingColumns.includes('requires_management_approval')) {
      await db.execute(sql`
        ALTER TABLE response_strategies
        ADD COLUMN requires_management_approval BOOLEAN NOT NULL DEFAULT false
      `);
      console.log('  ✅ Added requires_management_approval column');
    }

    // Add management_escalation_reason column
    if (!existingColumns.includes('management_escalation_reason')) {
      await db.execute(sql`
        ALTER TABLE response_strategies
        ADD COLUMN management_escalation_reason TEXT
      `);
      console.log('  ✅ Added management_escalation_reason column');
    }

    console.log('✅ Management escalation guardrail migration complete!');
    console.log('');
    console.log('📊 Schema updated:');
    console.log('  • response_strategies.requires_management_approval (BOOLEAN, NOT NULL, DEFAULT false)');
    console.log('  • response_strategies.management_escalation_reason (TEXT, NULLABLE)');
    console.log('');
    console.log('🎯 Ready for safe launch with high-risk ticket flagging');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function down() {
  console.log('⏪ Rolling back management escalation guardrail fields...');

  try {
    // Note: PostgreSQL doesn't support DROP COLUMN IF EXISTS in all versions
    // So we'll check first then drop
    const tableInfo = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'response_strategies'
      AND column_name IN ('requires_management_approval', 'management_escalation_reason')
    `);

    const existingColumns = tableInfo.rows.map(row => row.column_name);

    if (existingColumns.includes('management_escalation_reason')) {
      await db.execute(sql`
        ALTER TABLE response_strategies
        DROP COLUMN management_escalation_reason
      `);
      console.log('  ✅ Dropped management_escalation_reason column');
    }

    if (existingColumns.includes('requires_management_approval')) {
      await db.execute(sql`
        ALTER TABLE response_strategies
        DROP COLUMN requires_management_approval
      `);
      console.log('  ✅ Dropped requires_management_approval column');
    }

    console.log('✅ Rollback complete');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Run migration if called directly
const command = process.argv[2] || 'up';

if (command === 'up') {
  up()
    .then(() => {
      console.log('\n✅ Migration successful');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
} else if (command === 'down') {
  down()
    .then(() => {
      console.log('\n✅ Rollback successful');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Rollback failed:', error);
      process.exit(1);
    });
} else {
  console.log('Usage: npx tsx add-management-escalation-fields.ts [up|down]');
  process.exit(1);
}

export { up, down };
