import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function deepVerify() {
  console.log('🔍 Deep terminology verification...\n');

  // Get the damaged template
  const damaged = await sql`
    SELECT body_template
    FROM gold_responses
    WHERE category = 'damaged_missing_faulty'
  `;

  if (damaged.length > 0) {
    const body = damaged[0].body_template;

    console.log('=== DAMAGED TEMPLATE FULL TEXT ===\n');
    console.log(body);
    console.log('\n');

    // Check for forbidden words
    const hasDrawer = /drawer/i.test(body);
    const hasUnit = /unit/i.test(body);
    const hasSorry = /sorry/i.test(body);
    const hasApolog = /apolog/i.test(body);
    const hasBox = /Box/i.test(body);

    console.log('=== TERMINOLOGY CHECK ===');
    console.log(`✅ Uses "Box" terminology: ${hasBox}`);
    console.log(`✅ No "drawer" found: ${!hasDrawer}`);
    console.log(`✅ No "unit" found: ${!hasUnit}`);
    console.log(`✅ No "sorry" found: ${!hasSorry}`);
    console.log(`✅ No "apolog" found: ${!hasApolog}`);

    if (hasDrawer || hasUnit || hasSorry || hasApolog) {
      console.log('\n❌ ISSUES FOUND:');
      if (hasDrawer) console.log('  • Contains "drawer"');
      if (hasUnit) console.log('  • Contains "unit"');
      if (hasSorry) console.log('  • Contains apology language');
      if (hasApolog) console.log('  • Contains apology language');
    } else {
      console.log('\n✅ Template is production-ready!');
    }
  }

  // Get the policy snippet
  console.log('\n\n=== POLICY SNIPPET FULL TEXT ===\n');

  const policy = await sql`
    SELECT content
    FROM knowledge_snippets
    WHERE title = 'Damaged/Faulty Item Policy'
  `;

  if (policy.length > 0) {
    const content = policy[0].content;
    console.log(content);
    console.log('\n');

    const preservesDrawer = /never use "drawer" or "unit"/i.test(content);
    console.log('=== POLICY CHECK ===');
    console.log(`✅ Preserves negative examples: ${preservesDrawer}`);
  }
}

deepVerify().catch(console.error);
