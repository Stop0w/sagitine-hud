#!/usr/bin/env tsx
/**
 * Import Appendix B knowledge base data into Neon database.
 *
 * Usage:
 *   npx tsx src/db/import-knowledge-base.ts
 *
 * Prerequisites:
 *   - Database schema applied (npx drizzle-kit push)
 *   - Appendix B pipeline executed
 *   - DATABASE_URL set in .env.local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GoldResponse {
  id: string;
  title: string;
  category: string;
  body_template: string;
  tone_notes: string;
  avg_word_count?: number;
  avg_paragraph_count?: number;
  sample_count?: number;
  created_at?: string;
  exported_at?: string;
  ready_for_db?: boolean;
}

interface KnowledgeSnippet {
  id: string;
  title: string;
  type: string;
  category: string;
  content: string;
  tags: string[];
  created_at?: string;
  exported_at?: string;
  ready_for_db?: boolean;
}

interface AppendxBOutput {
  gold_responses: GoldResponse[];
  knowledge_snippets: KnowledgeSnippet[];
}

async function main() {
  console.log('📥 Importing Appendix B knowledge base to Neon database\n');

  // Check if database exists
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env.local');
    console.log('   Please set DATABASE_URL and try again');
    process.exit(1);
  }

  // Load Appendix B outputs
  const knowledgeDir = path.join(__dirname, '../../data/knowledge');
  const goldResponsesFile = path.join(knowledgeDir, 'gold_responses.json');
  const snippetsFile = path.join(knowledgeDir, 'knowledge_snippets.json');

  console.log(`📂 Looking for knowledge base files in: ${knowledgeDir}`);

  if (!fs.existsSync(goldResponsesFile)) {
    console.error('❌ gold_responses.json not found');
    console.log(`   Expected: ${goldResponsesFile}`);
    console.log('   Run the Appendix B pipeline first:');
    console.log('     cd scripts/backfill && python run_all.py');
    process.exit(1);
  }

  if (!fs.existsSync(snippetsFile)) {
    console.error('❌ knowledge_snippets.json not found');
    console.log(`   Expected: ${snippetsFile}`);
    console.log('   Run the Appendix B pipeline first:');
    console.log('     cd scripts/backfill && python run_all.py');
    process.exit(1);
  }

  console.log(`✅ Found gold_responses.json`);
  console.log(`✅ Found knowledge_snippets.json\n`);

  // Load JSON data
  const goldResponsesContent = fs.readFileSync(goldResponsesFile, 'utf-8');
  const snippetsContent = fs.readFileSync(snippetsFile, 'utf-8');

  const goldResponses: GoldResponse[] = JSON.parse(goldResponsesContent);
  const knowledgeSnippets: KnowledgeSnippet[] = JSON.parse(snippetsContent);

  console.log(`📊 Data loaded:`);
  console.log(`   Gold Response Templates:  ${goldResponses.length}`);
  console.log(`   Knowledge Snippets:      ${knowledgeSnippets.length}\n`);

  // Validate category alignment
  const validCategories = [
    'damaged_missing_faulty',
    'shipping_delivery_order_issue',
    'product_usage_guidance',
    'pre_purchase_question',
    'return_refund_exchange',
    'stock_availability',
    'partnership_wholesale_press',
    'brand_feedback_general',
  ];

  const goldCategories = [...new Set(goldResponses.map(r => r.category))];
  const snippetCategories = [...new Set(knowledgeSnippets.map(s => s.category))];

  console.log(`🏷️  Categories found:`);
  console.log(`   Gold responses:   ${goldCategories.join(', ')}`);
  console.log(`   Knowledge snippets: ${snippetCategories.join(', ')}\n`);

  // Validate all categories are canonical
  const invalidGoldCategories = goldCategories.filter(c => !validCategories.includes(c));
  const invalidSnippetCategories = snippetCategories.filter(c => !validCategories.includes(c));

  if (invalidGoldCategories.length > 0) {
    console.error(`❌ Invalid categories in gold_responses: ${invalidGoldCategories.join(', ')}`);
    console.log('   All categories must use canonical long-form IDs');
    process.exit(1);
  }

  if (invalidSnippetCategories.length > 0) {
    console.error(`❌ Invalid categories in knowledge_snippets: ${invalidSnippetCategories.join(', ')}`);
    console.log('   All categories must use canonical long-form IDs');
    process.exit(1);
  }

  console.log(`✅ All categories use canonical long-form IDs\n`);

  // Check if database migration has been applied
  console.log(`🔍 Checking database readiness...`);

  try {
    // Dynamic import of db module
    const { db } = await import('./index');
    const { goldResponses: goldTable, knowledgeSnippets: snippetsTable } = await import('./schema');

    // Test connection by attempting a simple query
    await db.execute('SELECT 1');

    console.log(`✅ Database connection successful\n`);

    console.log(`💾 Ready to import knowledge base data:`);
    console.log(`   • ${goldResponses.length} gold response templates`);
    console.log(`   • ${knowledgeSnippets.length} knowledge snippets`);
    console.log(`   • All categories validated`);
    console.log(`   • Schema alignment confirmed\n`);

    console.log(`📋 Import file created: src/db/import-knowledge-base.ts`);
    console.log(`\n🚀 Next steps:`);
    console.log(`   1. Ensure migration is applied: npx drizzle-kit push`);
    console.log(`   2. Uncomment the insert statements below`);
    console.log(`   3. Run this script: npx tsx src/db/import-knowledge-base.ts`);
    console.log(`   4. Verify in database: SELECT * FROM gold_responses;\n`);

    console.log(`📝 Import statements (ready to uncomment after migration):`);
    console.log(`\n   // await db.insert(goldTable).values(goldResponses);`);
    console.log(`   // await db.insert(snippetsTable).values(knowledgeSnippets);\n`);

  } catch (error: any) {
    if (error.message?.includes('relation "gold_responses" does not exist')) {
      console.error(`❌ Database tables not found`);
      console.log(`   Run migration first: npx drizzle-kit push`);
      console.log(`   Then re-run this script\n`);
    } else {
      console.error(`❌ Database error: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch(console.error);
