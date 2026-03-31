#!/usr/bin/env python3
"""
STEP 6: Generate knowledge objects from patterns.

Converts patterns into:
1. gold_responses - Response templates
2. knowledge_snippets - Policy/fact/guidance items

Ready for database insertion.
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import FILTERED_DIR, KNOWLEDGE_DIR, CATEGORY_LABELS, CATEGORIES
from utils import logger, save_json, load_json


def generate_gold_responses(patterns: dict) -> list:
    """
    Generate gold response templates from patterns.

    Each template includes:
    - title
    - category
    - body_template
    - tone_notes
    """
    gold_responses = []

    for category, cat_patterns in patterns.items():
        # Get response structure patterns
        structure = cat_patterns.get('response_structure', {})
        tone = cat_patterns.get('tone_patterns', {})
        openings = cat_patterns.get('opening_patterns', {}).get('most_common', [])
        closings = cat_patterns.get('closing_patterns', {}).get('most_common', [])

        # Create template title
        title = f"{CATEGORY_LABELS.get(category, category)} Response Template"

        # Build body template based on patterns
        body_parts = []

        # Opening (use most common)
        if openings:
            body_parts.append(f"# Opening\n{openings[0].capitalize()}\n")

        # Body structure notes
        body_parts.append(f"# Structure")
        body_parts.append(f"- Average length: {structure.get('typical_length', 'medium')}")
        body_parts.append(f"- Typical tone: Warm ({tone.get('warm_percentage', 0)}%) + Composed ({tone.get('composed_percentage', 0)}%)")
        body_parts.append("")

        # Tone guidance
        tone_notes = []
        if tone.get('warm_percentage', 0) > 50:
            tone_notes.append("Warm and approachable")
        if tone.get('composed_percentage', 0) > 50:
            tone_notes.append("Composed and confident")
        if tone.get('defensive_percentage', 0) > 20:
            tone_notes.append("WARNING: Some responses use defensive language - AVOID apologies")

        # Avoid patterns
        what_to_avoid = cat_patterns.get('what_to_avoid', [])
        if what_to_avoid:
            tone_notes.append(f"Avoid: {len(what_to_avoid)} problematic patterns found")

        # Create gold response
        gold_response = {
            'id': f"{category}_template",
            'title': title,
            'category': category,
            'body_template': '\n'.join(body_parts),
            'tone_notes': '; '.join(tone_notes) if tone_notes else 'Standard Sagitine tone: warm, composed, confident',
            'avg_word_count': structure.get('avg_word_count', 0),
            'avg_paragraph_count': structure.get('avg_paragraph_count', 0),
            'sample_count': cat_patterns.get('sample_count', 0),
            'created_from_patterns': True,
            'created_at': datetime.now().isoformat(),
        }

        gold_responses.append(gold_response)

    return gold_responses


def generate_knowledge_snippets(patterns: dict) -> list:
    """
    Generate knowledge snippets from patterns.

    Snippets are:
    - policy (rules/guidelines)
    - fact (product info)
    - guidance (how to respond)
    """
    snippets = []

    for category, cat_patterns in patterns.items():
        tone = cat_patterns.get('tone_patterns', {})
        phrasing = cat_patterns.get('phrasing_patterns', {})
        what_to_avoid = cat_patterns.get('what_to_avoid', [])

        # Policy snippet: Tone rules for this category
        tone_policy = {
            'id': f"{category}_tone_policy",
            'type': 'policy',
            'category': category,
            'content': f"""Tone Guidelines for {CATEGORY_LABELS.get(category, category)}:

- Warmth: {tone.get('warm_percentage', 0)}% (target: >60%)
- Composure: {tone.get('composed_percentage', 0)}% (target: >70%)
- Defensive language: {tone.get('defensive_percentage', 0)}% (target: <10%)

Key approach: {', '.join([cat_patterns.get('opening_patterns', {}).get('most_common', ['Professional'])[0]])}""",
            'tags': [category, 'tone', 'policy'],
            'created_at': datetime.now().isoformat(),
        }
        snippets.append(tone_policy)

        # Guidance snippet: What to avoid
        if what_to_avoid:
            avoid_examples = what_to_avoid[:3]  # Top 3 examples
            avoid_guidance = {
                'id': f"{category}_avoidance",
                'type': 'guidance',
                'category': category,
                'content': f"""What to Avoid in {CATEGORY_LABELS.get(category, category)} Responses:

{chr(10).join([f"- {ex.get('type', 'pattern').replace('_', ' ').title()}: Found {len([e for e in what_to_avoid if e.get('type') == ex.get('type')])} instances" for ex in avoid_examples])}

Remember: Never over-apologise. Use "thank you" instead of "sorry." Be confident and direct, not defensive.""",
                'tags': [category, 'avoidance', 'guidance'],
                'created_at': datetime.now().isoformat(),
            }
            snippets.append(avoid_guidance)

        # Policy snippet: Product terminology
        if 'box' in phrasing:
            box_usage = phrasing.get('box', {})
            terminology_policy = {
                'id': f"{category}_terminology",
                'type': 'policy',
                'category': category,
                'content': f"""Product Terminology for {CATEGORY_LABELS.get(category, category)}:

ALWAYS use: "Box"
NEVER use: "drawer"

Usage in this category: {box_usage.get('usage_count', 0)} instances ({box_usage.get('usage_percentage', 0)}% of responses)""",
                'tags': [category, 'terminology', 'policy'],
                'created_at': datetime.now().isoformat(),
            }
            snippets.append(terminology_policy)

        # Fact snippet: Category-specific info
        structure = cat_patterns.get('response_structure', {})
        fact_snippet = {
            'id': f"{category}_response_facts",
            'type': 'fact',
            'category': category,
            'content': f"""Response Patterns for {CATEGORY_LABELS.get(category, category)}:

- Typical word count: {structure.get('avg_word_count', 0)} words
- Average paragraphs: {structure.get('avg_paragraph_count', 0)}
- Response length: {structure.get('typical_length', 'medium')}""",
            'tags': [category, 'patterns', 'fact'],
            'created_at': datetime.now().isoformat(),
        }
        snippets.append(fact_snippet)

    return snippets


def main():
    """Main knowledge generation entry point."""
    logger.info("📚 Generating knowledge objects from patterns")

    # Load patterns
    patterns_file = FILTERED_DIR / 'extracted_patterns.json'

    if not patterns_file.exists():
        logger.error(f"❌ Pattern file not found: {patterns_file}")
        logger.info("   Run extract_patterns.py first")
        sys.exit(1)

    patterns = load_json(patterns_file)

    if not patterns:
        logger.error("❌ No patterns found")
        sys.exit(1)

    logger.info(f"📊 Loaded patterns for {len(patterns)} categories")

    # Generate gold responses
    logger.info("\n📝 Generating gold responses...")
    gold_responses = generate_gold_responses(patterns)
    logger.info(f"   Created {len(gold_responses)} response templates")

    # Generate knowledge snippets
    logger.info("\n📚 Generating knowledge snippets...")
    knowledge_snippets = generate_knowledge_snippets(patterns)
    logger.info(f"   Created {len(knowledge_snippets)} snippets")

    # Save outputs
    gold_file = KNOWLEDGE_DIR / 'gold_responses.json'
    snippets_file = KNOWLEDGE_DIR / 'knowledge_snippets.json'

    save_json(gold_responses, gold_file)
    save_json(knowledge_snippets, snippets_file)

    logger.info(f"\n✅ Knowledge generation complete!")
    logger.info(f"   Gold responses: {gold_file}")
    logger.info(f"   Knowledge snippets: {snippets_file}")

    # Print summary
    print("\n📊 Knowledge Summary:")
    print(f"  Gold Response Templates:  {len(gold_responses)}")
    print(f"  Knowledge Snippets:      {len(knowledge_snippets)}")

    print("\n  Response Templates by Category:")
    for response in gold_responses:
        print(f"    {response['category']}: {response['title']}")

    print("\n  Knowledge Snippets by Type:")
    snippet_types = {}
    for snippet in knowledge_snippets:
        stype = snippet.get('type', 'unknown')
        snippet_types[stype] = snippet_types.get(stype, 0) + 1

    for stype, count in snippet_types.items():
        print(f"    {stype}: {count}")


if __name__ == '__main__':
    main()
