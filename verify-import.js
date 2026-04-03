import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function verifyImport() {
  console.log('🔍 Verifying imported knowledge base...\n');

  // Check gold responses
  console.log('=== GOLD RESPONSES ===');
  const responses = await sql`
    SELECT title, category, sample_count, avg_word_count
    FROM gold_responses
    ORDER BY sample_count DESC
  `;

  console.log(`Total: ${responses.length} templates\n`);
  responses.forEach(r => {
    console.log(`• ${r.title}`);
    console.log(`  Category: ${r.category}`);
    console.log(`  Samples: ${r.sample_count}, Avg words: ${r.avg_word_count}`);
  });

  // Check knowledge snippets
  console.log('\n=== KNOWLEDGE SNIPPETS ===');
  const snippets = await sql`
    SELECT title, type, category
    FROM knowledge_snippets
    ORDER BY type, title
  `;

  const policies = snippets.filter(s => s.type === 'policy');
  const facts = snippets.filter(s => s.type === 'fact');

  console.log(`Total: ${snippets.length} snippets\n`);
  console.log(`Policies (${policies.length}):`);
  policies.forEach(s => console.log(`  • ${s.title}`));

  console.log(`\nFacts (${facts.length}):`);
  facts.forEach(s => console.log(`  • ${s.title}`));

  // Verify terminology in one gold response
  console.log('\n=== TERMINOLOGY VERIFICATION ===');
  const damaged = await sql`
    SELECT body_template
    FROM gold_responses
    WHERE category = 'damaged_missing_faulty'
  `;

  if (damaged.length > 0) {
    const body = damaged[0].body_template;

    console.log('Damaged template check:');
    console.log(`  • Contains "Box": ${body.includes('Box') ? '✅' : '❌'}`);
    console.log(`  • Contains "drawer": ${body.includes('drawer') ? '❌' : '✅'}`);
    console.log(`  • Contains "unit": ${body.includes('unit') ? '❌' : '✅'}`);
    console.log(`  • Contains "sorry": ${body.toLowerCase().includes('sorry') ? '❌' : '✅'}`);
    console.log(`  • Contains "apolog": ${body.toLowerCase().includes('apolog') ? '❌' : '✅'}`);

    // Show preview
    console.log('\nPreview (first 200 chars):');
    console.log(`  ${body.substring(0, 200).replace(/\n/g, ' ')}...`);
  }

  // Verify terminology in policy snippet
  console.log('\n=== POLICY TERMINOLOGY CHECK ===');
  const policy = await sql`
    SELECT content
    FROM knowledge_snippets
    WHERE title = 'Damaged/Faulty Item Policy'
  `;

  if (policy.length > 0) {
    const content = policy[0].content;

    console.log('Policy snippet check:');
    console.log(`  • Preserves "drawer" in instructions: ${content.includes('NEVER use "drawer"') ? '✅' : '❌'}`);
    console.log(`  • Preserves "unit" in instructions: ${content.includes('NEVER use "drawer" or "unit"') ? '✅' : '❌'}`);

    // Show the terminology line
    const lines = content.split(' ');
    const termIdx = lines.findIndex(w => w === 'Terminology:');
    if (termIdx >= 0) {
      console.log('\nTerminology instruction:');
      console.log(`  ${lines.slice(termIdx, termIdx + 15).join(' ')}`);
    }
  }

  console.log('\n✅ Verification complete!');
}

verifyImport().catch(console.error);
