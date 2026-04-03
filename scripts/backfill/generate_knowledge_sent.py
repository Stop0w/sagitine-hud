#!/usr/bin/env python3
"""
STEP 3: Generate knowledge base from CLASSIFIED sent emails.

Creates:
1. Gold responses - Response templates extracted from actual CX responses
2. Knowledge snippets - Policies, facts, and guidance extracted from responses
"""

import sys
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, Any, List

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import CATEGORIES, CATEGORY_LABELS, KNOWLEDGE_DIR
from utils import logger, save_json, load_json


def generate_gold_responses(classified_emails: List[Dict]) -> List[Dict]:
    """
    Generate gold response templates from classified emails.

    Each gold response is based on actual high-quality CX responses.
    """
    gold_responses = []

    # Group emails by category
    by_category = defaultdict(list)
    for email in classified_emails:
        if email.get('response_quality_score', 0) >= 8:  # Only high quality
            by_category[email['category']].append(email)

    # Generate template for each category
    for category, emails in by_category.items():
        if not emails:
            continue

        # Select a representative response (highest quality score)
        best_email = max(emails, key=lambda e: e.get('response_quality_score', 0))

        # Clean up CSS artifacts from response
        response_body = best_email.get('response_body', '')

        # Remove common CSS artifacts if present
        import re
        response_body = re.sub(r'v:\\?\*[^}]*\}+', '', response_body)
        response_body = re.sub(r'o:\\?\*[^}]*\}+', '', response_body)
        response_body = re.sub(r'w:\\?\*[^}]*\}+', '', response_body)
        response_body = re.sub(r'\.shape[^}]*\}+', '', response_body)
        response_body = re.sub(r'&nbsp;', ' ', response_body)
        response_body = re.sub(r'\s+', ' ', response_body).strip()

        # Create gold response
        gold_response = {
            'id': f"{category}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            'title': f"{CATEGORY_LABELS.get(category, category)} - Customer Response",
            'category': category,
            'body_template': response_body[:2000],  # Limit to 2000 chars for template
            'tone_notes': "Warm, composed, confident - standard Sagitine tone",
            'is_active': True,
            'use_count': len(emails),  # Number of similar responses
            'avg_word_count': sum(e.get('word_count', 0) for e in emails) // len(emails),
            'sample_count': len(emails),
            'created_at': datetime.now().isoformat(),
            'source_emails': len(emails),
        }

        gold_responses.append(gold_response)

    return gold_responses


def generate_knowledge_snippets(classified_emails: List[Dict]) -> List[Dict]:
    """
    Generate knowledge snippets from classified emails.

    Snippet types:
    - policy: Rules and guidelines
    - fact: Product information
    - guidance: How to respond to specific situations
    """
    snippets = []

    # Group by category
    by_category = defaultdict(list)
    for email in classified_emails:
        if email.get('response_quality_score', 0) >= 8:
            by_category[email['category']].append(email)

    for category, emails in by_category.items():
        if not emails:
            continue

        # Policy snippet: Tone guidelines for this category
        tone_policy = {
            'id': f"{category}_tone_policy",
            'type': 'policy',
            'category': category,
            'title': f"Tone Guidelines: {CATEGORY_LABELS.get(category, category)}",
            'content': f"""Response Guidelines for {CATEGORY_LABELS.get(category, category)}:

- Tone: Warm, composed, confident
- Always use "Box" not "drawer"
- Avoid over-apologizing (use "thank you" instead of "sorry")
- Be direct and helpful, not defensive
- Personal greeting (Hi [Name])
- Clear explanation or next steps

Based on {len(emails)} actual CX responses.""",
            'tags': [category, 'tone', 'policy', 'guidelines'],
            'is_active': True,
            'created_at': datetime.now().isoformat(),
        }
        snippets.append(tone_policy)

        # Fact snippet: Common themes in this category
        themes = []
        for email in emails[:20]:  # Sample first 20
            question = email.get('customer_question', '')
            if question and question not in themes:
                themes.append(question)

        fact_snippet = {
            'id': f"{category}_common_questions",
            'type': 'fact',
            'category': category,
            'title': f"Common Questions: {CATEGORY_LABELS.get(category, category)}",
            'content': f"""Most common customer questions for {CATEGORY_LABELS.get(category, category)}:

{chr(10).join([f"- {q}" for q in themes[:10]])}

Total analyzed: {len(emails)} responses.""",
            'tags': [category, 'questions', 'faq', 'fact'],
            'is_active': True,
            'created_at': datetime.now().isoformat(),
        }
        snippets.append(fact_snippet)

        # Guidance snippet: How to handle this category
        best_response = max(emails, key=lambda e: e.get('response_quality_score', 0))
        guidance_snippet = {
            'id': f"{category}_handling_guidance",
            'type': 'guidance',
            'category': category,
            'title': f"How to Handle: {CATEGORY_LABELS.get(category, category)}",
            'content': f"""Handling {CATEGORY_LABELS.get(category, category)} Inquiries:

Key approach:
1. Personal greeting with customer name
2. Acknowledge their question or situation
3. Provide clear, direct answer or next steps
4. Offer further assistance if needed

Example response structure:
{best_response.get('response_body', '')[:500]}...""",
            'tags': [category, 'handling', 'guidance', 'response'],
            'is_active': True,
            'created_at': datetime.now().isoformat(),
        }
        snippets.append(guidance_snippet)

    return snippets


def main():
    """Main knowledge generation entry point."""
    logger.info("Generating knowledge base from CLASSIFIED sent emails")

    # Load classified emails
    classified_file = Path(__file__).parent.parent.parent / 'data' / 'classified' / 'classified_sent_emails.json'

    if not classified_file.exists():
        logger.error(f"Classified emails file not found: {classified_file}")
        logger.info("Run classify_sent_emails.py first")
        sys.exit(1)

    classified_emails = load_json(classified_file)

    if not classified_emails:
        logger.error("No classified emails found")
        sys.exit(1)

    logger.info(f"Loaded {len(classified_emails)} classified emails")

    # Filter to high quality only
    high_quality = [e for e in classified_emails if e.get('response_quality_score', 0) >= 8]
    logger.info(f"High quality (8+): {len(high_quality)}")

    # Generate gold responses
    logger.info("\nGenerating gold responses...")
    gold_responses = generate_gold_responses(high_quality)
    logger.info(f"   Created {len(gold_responses)} gold response templates")

    # Generate knowledge snippets
    logger.info("\nGenerating knowledge snippets...")
    knowledge_snippets = generate_knowledge_snippets(high_quality)
    logger.info(f"   Created {len(knowledge_snippets)} knowledge snippets")

    # Save outputs
    gold_file = KNOWLEDGE_DIR / 'gold_responses.json'
    snippets_file = KNOWLEDGE_DIR / 'knowledge_snippets.json'

    save_json(gold_responses, gold_file)
    save_json(knowledge_snippets, snippets_file)

    logger.info(f"\n[OK] Knowledge generation complete!")
    logger.info(f"   Gold responses: {gold_file}")
    logger.info(f"   Knowledge snippets: {snippets_file}")

    # Print summary
    print("\n" + "="*60)
    print("KNOWLEDGE BASE SUMMARY")
    print("="*60)
    print(f"\nGold Response Templates: {len(gold_responses)}")
    for response in gold_responses:
        print(f"  - {response['title']}")

    print(f"\nKnowledge Snippets: {len(knowledge_snippets)}")
    snippet_types = defaultdict(int)
    for snippet in knowledge_snippets:
        snippet_types[snippet['type']] += 1

    for stype, count in snippet_types.items():
        print(f"  - {stype.capitalize()}: {count}")

    print("\n" + "="*60)


if __name__ == '__main__':
    main()
