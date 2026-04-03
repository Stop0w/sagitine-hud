import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });

// Read migration SQL
const migrationSQL = readFileSync(
  'src/db/migrations/0000_workable_doctor_octopus.sql',
  'utf-8'
);

console.log('🚀 Pushing migration to Neon...');

// Create database connection
const sql = neon(process.env.DATABASE_URL);

try {
  // Split by statement breaks
  const statements = migrationSQL
    .split('--> statement-breakpoint')
    .filter(s => s.trim())
    .map(s => s.trim());

  console.log(`  Found ${statements.length} SQL statements to execute`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`  Executing statement ${i + 1}/${statements.length}...`);

    try {
      // Use .query() for direct SQL execution
      await sql.query(statement);
      console.log(`    ✅ Done`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`    ⚠️  Already exists - continuing`);
      } else {
        console.error(`    ❌ Error: ${err.message}`);
        throw err;
      }
    }
  }

  console.log('\n✅ Migration pushed successfully!');
  console.log('\n📊 Schema created:');
  console.log('  ✅ gold_responses table');
  console.log('  ✅ knowledge_snippets table');
  console.log('  ✅ gold_category enum (8 categories)');
  console.log('  ✅ snippet_category enum (8 categories)');
  console.log('  ✅ snippet_type enum (policy, fact, guidance)');
  console.log('\n🎯 Ready for knowledge base import!');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}
