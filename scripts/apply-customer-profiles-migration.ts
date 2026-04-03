import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyCustomerProfilesMigration() {
  try {
    const migrationPath = join(__dirname, '../src/db/migrations/0002_remarkable_iron_lad.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split by statement separator and execute each statement
    const statements = migrationSQL.split('--> statement-breakpoint');

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        console.log('Executing:', trimmed.substring(0, 80) + '...');
        await sql.query(trimmed);
      }
    }

    console.log('\n✓ Customer profiles migration applied successfully!');
    console.log('✓ Created: customer_profiles table');
    console.log('✓ Created: customer_contact_facts table');
    console.log('✓ Created: contact_channel, contact_direction enums');
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

applyCustomerProfilesMigration();
