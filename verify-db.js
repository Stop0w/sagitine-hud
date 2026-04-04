import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function verifyDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 Connecting to database...');
    await client.connect();
    console.log('✅ Database connection successful');

    // Check if tickets table exists and get record count
    console.log('\n📊 Checking tickets table...');
    const countResult = await client.query('SELECT COUNT(*) FROM tickets');
    console.log(`✅ Tickets table exists with ${countResult.rows[0].count} records`);

    // List all tables
    console.log('\n📋 Listing all tables...');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('✅ Available tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Get tickets table schema
    console.log('\n🔧 Tickets table schema:');
    const schemaResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tickets'
      ORDER BY ordinal_position
    `);
    schemaResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n✅ Database verification complete - all checks passed!');

  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyDatabase();
