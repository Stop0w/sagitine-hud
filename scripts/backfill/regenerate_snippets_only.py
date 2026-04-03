#!/usr/bin/env python3
"""
Regenerate ONLY knowledge snippets (not gold responses).
"""

import sys
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import CATEGORIES, CATEGORY_LABELS, KNOWLEDGE_DIR
from utils import logger, save_json
from clean_email_properly import clean_response_body, is_production_ready


def create_knowledge_snippet(category: str, snippet_type: str, title: str, content: str, tags: List[str]) -> Dict[str, Any]:
    """Create production-ready knowledge snippet."""

    # For policy and terminology facts, preserve instructional text
    if snippet_type == 'policy' or (snippet_type == 'fact' and 'Terminology' in title):
        # Skip term scrubbing for policies and terminology facts - they contain instructional examples
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
        # For other facts and guidance, apply full cleaning including term scrubbing
        cleaned_content = clean_response_body(content)

        # Check if production-ready
        is_ready, reason = is_production_ready(cleaned_content)
        if not is_ready:
            return None

        # Term scrub for non-policy, non-terminology content
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
    """Regenerate knowledge snippets only."""
    logger.info("REGENERATING knowledge snippets with fixed policies")

    # Generate policy snippets
    policy_snippets = generate_policy_snippets()
    policy_snippets = [s for s in policy_snippets if s]  # Filter out None
    logger.info(f"  Policy snippets: {len(policy_snippets)}")

    # Generate fact snippets
    fact_snippets = generate_product_facts()
    fact_snippets = [s for s in fact_snippets if s]
    logger.info(f"  Fact snippets: {len(fact_snippets)}")

    # No guidance snippets for now
    guidance_snippets = []

    # Combine all snippets
    all_snippets = policy_snippets + fact_snippets + guidance_snippets

    # Save snippets
    snippets_file = KNOWLEDGE_DIR / 'knowledge_snippets.json'
    save_json(all_snippets, snippets_file)

    logger.info(f"\n{'='*60}")
    logger.info("KNOWLEDGE SNIPPETS REGENERATED")
    logger.info('='*60)
    logger.info(f"\nTotal snippets: {len(all_snippets)}")

    for stype in ['policy', 'fact', 'guidance']:
        count = len([s for s in all_snippets if s['type'] == stype])
        if count > 0:
            logger.info(f"  - {stype.capitalize()}: {count}")

    logger.info(f"\nSaved: {snippets_file}")

    # Print samples
    print(f"\n{'='*60}")
    print("SAMPLE OUTPUTS")
    print('='*60)

    print(f"\nPOLICY SNIPPETS ({len(policy_snippets)}):")
    for i, snippet in enumerate(policy_snippets, 1):
        print(f"\n{i}. {snippet['title']}")
        print(f"   Content preview:")
        print(f"   {snippet['content'][:200]}...")

    print(f"\n\nFACT SNIPPETS ({len(fact_snippets)}):")
    for i, snippet in enumerate(fact_snippets, 1):
        print(f"\n{i}. {snippet['title']}")
        print(f"   Content preview:")
        print(f"   {snippet['content'][:200]}...")

    print(f"\n{'='*60}")


if __name__ == '__main__':
    main()
