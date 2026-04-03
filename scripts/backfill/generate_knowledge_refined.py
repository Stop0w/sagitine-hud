#!/usr/bin/env python3
"""
REFINED knowledge generation - production-ready outputs.

Creates:
1. Gold responses - Reusable templates with placeholders
2. Knowledge snippets - Clean, operationally useful
3. Quality filtering - Rejects bad entries
"""

import sys
import json
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, Any, List, Tuple

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import CATEGORIES, CATEGORY_LABELS, KNOWLEDGE_DIR
from utils import logger, save_json, load_json

# Import proper cleaning functions
from clean_email_properly import clean_response_body, is_production_ready, make_reusable_template, enforce_sagitine_tone


def create_gold_template(category: str, emails: List[Dict]) -> Dict[str, Any]:
    """
    Create production-ready gold response template.

    Must be:
    - Reusable (no specific names/dates)
    - Clean (no artifacts)
    - Sagitine tone (composed, structured, elevated)
    """

    if not emails:
        return None

    # Select best response (highest quality score)
    best = max(emails, key=lambda e: e.get('response_quality_score', 0))

    # Clean the response
    body = clean_response_body(best.get('response_body', ''))

    # Check if production-ready
    is_ready, reason = is_production_ready(body)
    if not is_ready:
        logger.warning(f"  ⚠️  Skipping {category}: {reason}")
        return None

    # Make it reusable
    body = make_reusable_template(body)

    # Enforce Sagitine tone
    body = enforce_sagitine_tone(body)

    # Term scrub: drawer → Box/Stand
    body = re.sub(r'\bdrawer\b', 'Box', body, flags=re.IGNORECASE)
    body = re.sub(r'\bunit\b', 'Box', body, flags=re.IGNORECASE)

    # Validate it still meets quality standards
    if len(body) < 100:
        return None

    return {
        'id': f"{category}_template",
        'title': f"{CATEGORY_LABELS.get(category, category)} Response Template",
        'category': category,
        'body_template': body,
        'tone_notes': "Composed, structured, elevated - Sagitine brand voice",
        'is_active': True,
        'use_count': len(emails),
        'avg_word_count': sum(e.get('word_count', 0) for e in emails) // len(emails),
        'sample_count': len(emails),
        'created_at': datetime.now().isoformat(),
        'quality_score': best.get('response_quality_score', 0),
    }


def create_knowledge_snippet(category: str, snippet_type: str, title: str, content: str, tags: List[str]) -> Dict[str, Any]:
    """Create production-ready knowledge snippet."""

    # For policy snippets, preserve instructional text about terminology
    if snippet_type == 'policy':
        # Skip term scrubbing for policies - they contain instructional examples
        # Only clean HTML artifacts and structure
        cleaned_content = clean_response_body(content)

        # Check if production-ready
        is_ready, reason = is_production_ready(cleaned_content)
        if not is_ready:
            return None

        # Validate snippet quality
        if len(cleaned_content) < 50:
            return None

        final_content = cleaned_content
    else:
        # For facts and guidance, apply full cleaning including term scrubbing
        cleaned_content = clean_response_body(content)

        # Check if production-ready
        is_ready, reason = is_production_ready(cleaned_content)
        if not is_ready:
            return None

        # Term scrub for non-policy content
        cleaned_content = re.sub(r'\bdrawer\b', 'Box', cleaned_content, flags=re.IGNORECASE)
        cleaned_content = re.sub(r'\bunit\b', 'Box', cleaned_content, flags=re.IGNORECASE)

        # Validate snippet quality
        if len(cleaned_content) < 50:
            return None

        final_content = cleaned_content

    return {
        'id': f"{category}_{snippet_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        'title': title,
        'type': snippet_type,
        'category': category,
        'content': final_content,
        'tags': tags,
        'source': 'backfill_pipeline_refined',
        'is_active': True,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


def generate_policy_snippets() -> List[Dict]:
    """Generate Sagitine policy knowledge snippets."""

    policies = [
        {
            'category': 'damaged_missing_faulty',
            'title': 'Damaged/Faulty Item Policy',
            'content': """Sagitine Damaged Item Policy

All damaged or faulty items will be replaced free of charge.

Process:
1. Customer provides photo evidence
2. We assess the damage
3. Replacement shipped within 2 business days
4. No return shipping required

Terminology: ALWAYS use "Box", NEVER use "drawer" or "unit".

Tone: Composed, confident, solution-focused. Thank the customer for reporting the issue, do not apologize.""",
            'tags': ['damaged', 'faulty', 'replacement', 'policy'],
        },
        {
            'category': 'shipping_delivery_order_issue',
            'title': 'Shipping Expectations Policy',
            'content': """Sagitine Shipping Policy

Standard shipping: 5-7 business days
Express shipping: 2-3 business days
Pre-orders: Ships as estimated on product page

International shipping: Available to most countries
Tracking: Provided on dispatch

All Boxes shipped in protective packaging to prevent damage.""",
            'tags': ['shipping', 'delivery', 'timelines', 'policy'],
        },
        {
            'category': 'return_refund_exchange',
            'title': 'Returns & Refunds Policy',
            'content': """Sagitine Returns Policy

30-day return window for unused items
Item must be in original packaging

Refunds processed within 5 business days
Exchanges available for all products

Contact us via reply email to initiate return
We provide return shipping label""",
            'tags': ['returns', 'refunds', 'exchanges', 'policy'],
        },
        {
            'category': 'stock_availability',
            'title': 'Pre-Order Policy',
            'content': """Sagitine Pre-Order Policy

Pre-orders ship in the estimated timeframe
Updates provided via email for any delays

Orders can be cancelled before shipping
Payment processed at shipping, not order time

All pre-orders receive priority shipping once available""",
            'tags': ['pre-order', 'stock', 'policy'],
        },
    ]

    return [create_knowledge_snippet(p['category'], 'policy', p['title'], p['content'], p['tags']) for p in policies]


def generate_product_facts() -> List[Dict]:
    """Generate Sagitine product fact snippets."""

    facts = [
        {
            'category': 'product_usage_guidance',
            'title': 'Box Terminology',
            'content': """Sagitine Product Terminology

ALWAYS USE: "Box" or "Stand"
NEVER USE: "drawer", "unit"

Correct example: "Your Box includes 3 compartments"
Incorrect example: "Your drawer includes 3 compartments"

This terminology applies to all Sagitine storage products.""",
            'tags': ['terminology', 'product', 'fact'],
        },
        {
            'category': 'product_usage_guidance',
            'title': 'Box Care Instructions',
            'content': """Box Care Guidelines

Our Boxes are finished with premium materials
Wipe clean with dry, soft cloth
Avoid harsh chemicals or abrasives
Not suitable for dishwasher cleaning

For timber products, use food-safe timber oil quarterly
Maintain in dry environment away from direct heat sources""",
            'tags': ['care', 'maintenance', 'product', 'fact'],
        },
        {
            'category': 'product_usage_guidance',
            'title': 'Assembly Guidelines',
            'content': """Box Assembly Instructions

All stands require minimal assembly
Tools needed: Allen key (included)

Assembly time: 5-10 minutes
Instructions provided in packaging

Can be assembled by one person
Sturdy construction once assembled""",
            'tags': ['assembly', 'setup', 'installation', 'fact'],
        },
    ]

    return [create_knowledge_snippet(f['category'], 'fact', f['title'], f['content'], f['tags']) for f in facts]


def main():
    """Main refined knowledge generation entry point."""
    logger.info("🔧 REFINING knowledge base for production use")

    # Load classified emails
    classified_file = Path(__file__).parent.parent.parent / 'data' / 'classified' / 'classified_sent_emails.json'

    if not classified_file.exists():
        logger.error(f"Classified emails not found: {classified_file}")
        logger.info("Run classify_sent_emails.py first")
        sys.exit(1)

    classified_emails = load_json(classified_file)

    # Filter to high quality only
    high_quality = [e for e in classified_emails if e.get('response_quality_score', 0) >= 8]
    logger.info(f"📊 High-quality emails: {len(high_quality)}/{len(classified_emails)}")

    # Group by category
    by_category = defaultdict(list)
    for email in high_quality:
        by_category[email['category']].append(email)

    logger.info(f"\n📝 Creating gold response templates...")

    # Generate gold responses
    gold_responses = []
    for category, emails in by_category.items():
        template = create_gold_template(category, emails)
        if template:
            gold_responses.append(template)
            logger.info(f"  ✅ {CATEGORY_LABELS.get(category, category)}: {len(emails)} samples")
        else:
            logger.warning(f"  ⚠️  {CATEGORY_LABELS.get(category, category)}: Rejected (quality issues)")

    logger.info(f"\n📚 Creating knowledge snippets...")

    # Generate policy snippets
    policy_snippets = generate_policy_snippets()
    policy_snippets = [s for s in policy_snippets if s]  # Filter out None
    logger.info(f"  Policy snippets: {len(policy_snippets)}")

    # Generate fact snippets
    fact_snippets = generate_product_facts()
    fact_snippets = [s for s in fact_snippets if s]
    logger.info(f"  Fact snippets: {len(fact_snippets)}")

    # Generate guidance snippets from actual responses
    guidance_snippets = []
    for category, emails in list(by_category.items())[:5]:  # Top 5 categories
        if emails:
            best = max(emails, key=lambda e: e.get('response_quality_score', 0))
            body = clean_response_body(best.get('response_body', ''))

            if body and len(body) > 100:
                guidance = create_knowledge_snippet(
                    category,
                    'guidance',
                    f"How to Handle: {CATEGORY_LABELS.get(category, category)}",
                    f"""Handling {CATEGORY_LABELS.get(category, category)} Inquiries:

Key approach:
1. Personal greeting with customer name
2. Acknowledge their situation clearly
3. Provide direct, confident answer or next steps
4. Offer further assistance

Tone: Composed, structured, warm but not casual

Example structure based on {len(emails)} actual responses:

{body[:500]}...
""",
                    ['handling', 'guidance', category]
                )
                if guidance:
                    guidance_snippets.append(guidance)

    logger.info(f"  Guidance snippets: {len(guidance_snippets)}")

    # Combine all snippets
    all_snippets = policy_snippets + fact_snippets + guidance_snippets

    # Save outputs
    gold_file = KNOWLEDGE_DIR / 'gold_responses.json'
    snippets_file = KNOWLEDGE_DIR / 'knowledge_snippets.json'

    save_json(gold_responses, gold_file)
    save_json(all_snippets, snippets_file)

    # Create export summary
    export_summary = {
        'generated_at': datetime.now().isoformat(),
        'gold_responses': {
            'total': len(gold_responses),
            'by_category': {
                r['category']: {
                    'title': r['title'],
                    'sample_count': r['sample_count'],
                    'quality_score': r['quality_score']
                }
                for r in gold_responses
            }
        },
        'knowledge_snippets': {
            'total': len(all_snippets),
            'by_type': {
                stype: len([s for s in all_snippets if s['type'] == stype])
                for stype in ['policy', 'fact', 'guidance']
            }
        }
    }

    summary_file = KNOWLEDGE_DIR / 'export_summary.json'
    save_json(export_summary, summary_file)

    logger.info(f"\n{'='*60}")
    logger.info("🎉 REFINED KNOWLEDGE BASE COMPLETE")
    logger.info('='*60)
    logger.info(f"\n✅ Gold Response Templates: {len(gold_responses)}")
    for r in gold_responses:
        logger.info(f"  - {r['title']}")

    logger.info(f"\n✅ Knowledge Snippets: {len(all_snippets)}")
    for stype in ['policy', 'fact', 'guidance']:
        count = len([s for s in all_snippets if s['type'] == stype])
        logger.info(f"  - {stype.capitalize()}: {count}")

    logger.info(f"\n📁 Outputs:")
    logger.info(f"  • {gold_file}")
    logger.info(f"  • {snippets_file}")
    logger.info(f"  • {summary_file}")

    # Print samples
    print(f"\n{'='*60}")
    print("SAMPLE OUTPUTS (for review)")
    print('='*60)

    print(f"\n📝 GOLD RESPONSE SAMPLES (showing 3 of {len(gold_responses)}):")
    for i, response in enumerate(gold_responses[:3], 1):
        print(f"\n{i}. {response['title']}")
        print(f"   Category: {response['category']}")
        print(f"   Quality Score: {response['quality_score']}/10")
        print(f"   Template Preview:")
        print(f"   {response['body_template'][:400]}...")

    print(f"\n\n📚 KNOWLEDGE SNIPPET SAMPLES (showing 5 of {len(all_snippets)}):")
    for i, snippet in enumerate(all_snippets[:5], 1):
        print(f"\n{i}. {snippet['title']}")
        print(f"   Type: {snippet['type']}")
        print(f"   Category: {snippet['category']}")
        print(f"   Content:")
        print(f"   {snippet['content'][:300]}...")

    print(f"\n{'='*60}")


if __name__ == '__main__':
    main()
