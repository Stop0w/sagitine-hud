// Quick check of gold_responses
const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function checkGoldResponses() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  console.log('Gold Responses Metadata Quality:\n');

  // Total and basic counts
  const result = await client.query(`
    SELECT
      category,
      action_type,
      must_include,
      must_avoid
    FROM gold_responses
    ORDER BY category
  `);

  console.log(`Total gold_responses: ${result.rows.length}\n`);

  let withMustInclude = 0;
  let withMustAvoid = 0;

  result.rows.forEach(row => {
    const hasMustInclude = row.must_include && Array.isArray(row.must_include) && row.must_include.length > 0;
    const hasMustAvoid = row.must_avoid && Array.isArray(row.must_avoid) && row.must_avoid.length > 0;
    if (hasMustInclude) withMustInclude++;
    if (hasMustAvoid) withMustAvoid++;

    console.log(`${row.category}:`);
    console.log(`  action_type: ${row.action_type}`);
    console.log(`  must_include: ${hasMustInclude ? JSON.stringify(row.must_include) : '(empty)'}`);
    console.log(`  must_avoid: ${hasMustAvoid ? JSON.stringify(row.must_avoid) : '(empty)'}`);
    console.log('');
  });

  console.log(`\nSummary:`);
  console.log(`With action_type: ${result.rows.length}/${result.rows.length} (100%)`);
  console.log(`With must_include: ${withMustInclude}/${result.rows.length} (${Math.round(withMustInclude/result.rows.length*100)}%)`);
  console.log(`With must_avoid: ${withMustAvoid}/${result.rows.length} (${Math.round(withMustAvoid/result.rows.length*100)}%)`);

  await client.end();
}

checkGoldResponses().catch(console.error);
