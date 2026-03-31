#!/usr/bin/env python3
"""
STEP 7: Export and validate final outputs.

Combines outputs into:
- data/knowledge/gold_responses.json
- data/knowledge/knowledge_snippets.json

Ensures:
- Clean formatting
- No duplicates
- No empty fields
- Ready for database insertion
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import KNOWLEDGE_DIR, CATEGORIES
from utils import logger, save_json, load_json


def validate_gold_response(response: dict) -> bool:
    """Validate gold response has all required fields."""
    required_fields = ['id', 'title', 'category', 'body_template', 'tone_notes']

    for field in required_fields:
        if not response.get(field):
            logger.warning(f"Invalid gold response: missing {field}")
            return False

    # Validate category
    if response.get('category') not in CATEGORIES:
        logger.warning(f"Invalid category: {response.get('category')}")
        return False

    return True


def validate_knowledge_snippet(snippet: dict) -> bool:
    """Validate knowledge snippet has all required fields."""
    required_fields = ['id', 'type', 'category', 'content', 'tags']

    for field in required_fields:
        if not snippet.get(field):
            logger.warning(f"Invalid snippet: missing {field}")
            return False

    # Validate type
    valid_types = ['policy', 'fact', 'guidance']
    if snippet.get('type') not in valid_types:
        logger.warning(f"Invalid snippet type: {snippet.get('type')}")
        return False

    return True


def remove_duplicate_gold_responses(responses: list) -> list:
    """Remove duplicate gold responses by ID."""
    seen_ids = set()
    unique_responses = []

    for response in responses:
        response_id = response.get('id')
        if response_id and response_id not in seen_ids:
            seen_ids.add(response_id)
            unique_responses.append(response)
        else:
            logger.warning(f"Duplicate gold response ID: {response_id}")

    return unique_responses


def remove_duplicate_snippets(snippets: list) -> list:
    """Remove duplicate snippets by ID."""
    seen_ids = set()
    unique_snippets = []

    for snippet in snippets:
        snippet_id = snippet.get('id')
        if snippet_id and snippet_id not in seen_ids:
            seen_ids.add(snippet_id)
            unique_snippets.append(snippet)
        else:
            logger.warning(f"Duplicate snippet ID: {snippet_id}")

    return unique_snippets


def add_export_metadata(responses: list, snippets: list) -> tuple:
    """Add export metadata to outputs."""
    export_timestamp = datetime.now().isoformat()

    for response in responses:
        response['exported_at'] = export_timestamp
        response['ready_for_db'] = True

    for snippet in snippets:
        snippet['exported_at'] = export_timestamp
        snippet['ready_for_db'] = True

    return responses, snippets


def generate_db_insertion_sql(responses: list, snippets: list) -> str:
    """Generate SQL insertion statements for database import."""
    sql_parts = []

    # Gold responses
    sql_parts.append("-- Gold Responses")
    sql_parts.append("INSERT INTO gold_responses (title, category, body_template, tone_notes, is_active, use_count, created_at, updated_at) VALUES")

    values = []
    for response in responses:
        values.append(f"""  (
    '{response.get('title').replace("'", "''")}',
    '{response.get('category')}',
    '{response.get('body_template').replace("'", "''")}',
    '{response.get('tone_notes').replace("'", "''")}',
    true,
    0,
    NOW(),
    NOW()
  )""")

    sql_parts.append(',\n'.join(values) + ';')

    # Knowledge snippets
    sql_parts.append("\n-- Knowledge Snippets")
    sql_parts.append("INSERT INTO knowledge_snippets (title, category, content, source, is_active, created_at, updated_at) VALUES")

    values = []
    for snippet in snippets:
        values.append(f"""  (
    '{snippet.get('id')}',
    '{snippet.get('category')}',
    '{snippet.get('content').replace("'", "''")}',
    'backfill_pipeline',
    true,
    NOW(),
    NOW()
  )""")

    sql_parts.append(',\n'.join(values) + ';')

    return '\n'.join(sql_parts)


def main():
    """Main export entry point."""
    logger.info("📦 Exporting final knowledge outputs")

    # Load generated knowledge
    gold_file = KNOWLEDGE_DIR / 'gold_responses.json'
    snippets_file = KNOWLEDGE_DIR / 'knowledge_snippets.json'

    if not gold_file.exists() or not snippets_file.exists():
        logger.error("❌ Knowledge files not found")
        logger.info("   Run generate_knowledge.py first")
        sys.exit(1)

    gold_responses = load_json(gold_file)
    knowledge_snippets = load_json(snippets_file)

    logger.info(f"📊 Loaded {len(gold_responses)} gold responses")
    logger.info(f"📊 Loaded {len(knowledge_snippets)} knowledge snippets")

    # Validate
    logger.info("\n✅ Validating gold responses...")
    gold_responses = [r for r in gold_responses if validate_gold_response(r)]

    logger.info("✅ Validating knowledge snippets...")
    knowledge_snippets = [s for s in knowledge_snippets if validate_knowledge_snippet(s)]

    # Remove duplicates
    logger.info("🔍 Removing duplicates...")
    gold_responses = remove_duplicate_gold_responses(gold_responses)
    knowledge_snippets = remove_duplicate_snippets(knowledge_snippets)

    # Add export metadata
    gold_responses, knowledge_snippets = add_export_metadata(gold_responses, knowledge_snippets)

    # Save cleaned outputs
    logger.info("\n💾 Saving final outputs...")
    save_json(gold_responses, gold_file)
    save_json(knowledge_snippets, snippets_file)

    # Generate SQL insertion script
    logger.info("\n📝 Generating SQL insertion script...")
    sql = generate_db_insertion_sql(gold_responses, knowledge_snippets)
    sql_file = KNOWLEDGE_DIR / 'db_insertion.sql'
    Path(sql_file).write_text(sql, encoding='utf-8')
    logger.info(f"   SQL script: {sql_file}")

    # Generate summary
    summary = {
        'export_timestamp': datetime.now().isoformat(),
        'gold_responses_count': len(gold_responses),
        'knowledge_snippets_count': len(knowledge_snippets),
        'categories_covered': list(set(r.get('category') for r in gold_responses)),
        'snippet_types': list(set(s.get('type') for s in knowledge_snippets)),
        'files_generated': [
            str(gold_file),
            str(snippets_file),
            str(sql_file),
        ],
    }

    summary_file = KNOWLEDGE_DIR / 'export_summary.json'
    save_json(summary, summary_file)

    # Print final summary
    print("\n" + "="*60)
    print("   BACKFILL PIPELINE - EXPORT COMPLETE")
    print("="*60)
    print(f"\n📊 Final Outputs:")
    print(f"   Gold Response Templates:  {len(gold_responses)}")
    print(f"   Knowledge Snippets:      {len(knowledge_snippets)}")
    print(f"   Categories Covered:      {len(summary['categories_covered'])}")
    print(f"   Snippet Types:           {', '.join(summary['snippet_types'])}")

    print(f"\n📁 Files Generated:")
    for file_path in summary['files_generated']:
        print(f"   {file_path}")

    print(f"\n✅ Ready for database insertion!")
    print(f"   Use {sql_file} for direct SQL import")
    print(f"   or import JSON files programmatically")

    print(f"\n🎯 Next Steps:")
    print(f"   1. Review gold_responses.json for quality")
    print(f"   2. Review knowledge_snippets.json for accuracy")
    print(f"   3. Run db_insertion.sql in Neon database")
    print(f"   4. Verify records in gold_responses and knowledge_snippets tables")


if __name__ == '__main__':
    main()
