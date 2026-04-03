import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

// Load environment variables
config({ path: '.env' });

console.log('📥 Importing knowledge base to Neon...\n');

// Read JSON files
const goldResponses = JSON.parse(readFileSync('data/knowledge/gold_responses.json', 'utf-8'));
const knowledgeSnippets = JSON.parse(readFileSync('data/knowledge/knowledge_snippets.json', 'utf-8'));

console.log(`✅ Loaded ${goldResponses.length} gold responses`);
console.log(`✅ Loaded ${knowledgeSnippets.length} knowledge snippets\n`);

// Create database connection
const sql = neon(process.env.DATABASE_URL);

try {
  // Import gold responses
  console.log('⏳ Importing gold responses...');
  for (const response of goldResponses) {
    // Generate proper UUID
    const id = randomUUID();

    const query = `
      INSERT INTO gold_responses (
        id, title, category, body_template, tone_notes,
        is_active, use_count, avg_word_count, avg_paragraph_count,
        sample_count, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      ON CONFLICT (id) DO NOTHING
    `;

    await sql.query(query, [
      id,
      response.title,
      response.category,
      response.body_template,
      response.tone_notes,
      response.is_active ?? true,
      response.use_count ?? 0,
      response.avg_word_count || null,
      null, // avg_paragraph_count
      response.sample_count || null,
      response.created_at || new Date().toISOString(),
      new Date().toISOString()
    ]);
  }
  console.log(`   ✅ Imported ${goldResponses.length} gold responses`);

  // Import knowledge snippets
  console.log('\n⏳ Importing knowledge snippets...');
  for (const snippet of knowledgeSnippets) {
    // Generate proper UUID
    const id = randomUUID();

    const query = `
      INSERT INTO knowledge_snippets (
        id, title, type, category, content, tags,
        source, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      ON CONFLICT (id) DO NOTHING
    `;

    await sql.query(query, [
      id,
      snippet.title,
      snippet.type,
      snippet.category,
      snippet.content,
      JSON.stringify(snippet.tags || []),
      'backfill_pipeline',
      snippet.is_active ?? true,
      snippet.created_at || new Date().toISOString(),
      new Date().toISOString()
    ]);
  }
  console.log(`   ✅ Imported ${knowledgeSnippets.length} knowledge snippets`);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 KNOWLEDGE BASE IMPORT COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n✅ Successfully imported to Neon database:');
  console.log(`   • ${goldResponses.length} gold response templates`);
  console.log(`   • ${knowledgeSnippets.length} knowledge snippets`);
  console.log('\n💡 Verify in Neon console: https://console.neon.tech');
  console.log('   Run query: SELECT * FROM gold_responses;\n');

} catch (error) {
  console.error('\n❌ Import failed:', error.message);
  process.exit(1);
}
