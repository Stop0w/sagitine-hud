// Check gold_responses metadata quality
const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function checkGoldResponses() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  console.log('Checking gold_responses metadata quality...\n');

  // Total count
  const totalResult = await client.query(`
    SELECT COUNT(*) as count FROM gold_responses
  `);
  const total = parseInt(totalResult.rows[0].count);

  // Non-null action_type
  const actionTypeResult = await client.query(`
    SELECT COUNT(*) as count FROM gold_responses WHERE action_type IS NOT NULL
  `);
  const withActionType = parseInt(actionTypeResult.rows[0].count);

  // Non-empty must_include
  const mustIncludeResult = await client.query(`
    SELECT COUNT(*) as count FROM gold_responses
    WHERE jsonb_array_length(must_include) > 0
  `);
  const withMustInclude = parseInt(mustIncludeResult.rows[0].count);

  // Non-empty must_avoid
  const mustAvoidResult = await client.query(`
    SELECT COUNT(*) as count FROM gold_responses
    WHERE jsonb_array_length(must_avoid) > 0
  `);
  const withMustAvoid = parseInt(mustAvoidResult.rows[0].count);

  // Show breakdown by category
  const byCategory = await client.query(`
    SELECT
      category,
      COUNT(*) as count,
      COUNT(action_type) as with_action_type
    FROM gold_responses
    GROUP BY category
    ORDER BY count DESC
  `);

  console.log('Gold Responses Metadata Quality:\n');
  console.log(`Total gold_responses: ${total}`);
  console.log(`With action_type: ${withActionType}/${total} (${Math.round(withActionType/total*100)}%)`);
  console.log(`With must_include: ${withMustInclude}/${total} (${Math.round(mustInclude/total*100)}%)`);
  console.log(`With must_avoid: ${withMustAvoid}/${total} (${Math.round(mustAvoid/total*100)}%)\n`);

  console.log('Breakdown by category:\n');
  byCategory.rows.forEach(row => {
    console.log(`${row.category}: ${row.count} rows, action_type: ${row.with_action_type}`);
  });

  await client.end();
}

checkGoldResponses().catch(console.error);
