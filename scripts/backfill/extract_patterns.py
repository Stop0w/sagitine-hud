#!/usr/bin/env python3
"""
STEP 5: Extract patterns from classified emails.

Groups by category and extracts:
- Response structure
- Tone patterns
- Phrasing patterns
- Opening styles
- Closing styles
- What to avoid

Outputs structured JSON for knowledge generation.
"""

import sys
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import FILTERED_DIR, CATEGORIES
from utils import logger, save_json, load_json_files, print_progress


def extract_opening_patterns(texts: list) -> dict:
    """Extract common opening phrases."""
    openings = []

    for text in texts:
        if not text:
            continue

        # Get first sentence
        first_sentence = text.split('.')[0].split('\n')[0].strip()
        if first_sentence and len(first_sentence) > 5:
            openings.append(first_sentence.lower())

    # Count most common
    common_openings = Counter(openings).most_common(10)

    return {
        'most_common': [item[0] for item in common_openings],
        'sample_count': len(openings),
    }


def extract_closing_patterns(texts: list) -> dict:
    """Extract common closing phrases."""
    closings = []

    for text in texts:
        if not text:
            continue

        # Get last sentence
        sentences = text.split('.')
        if sentences:
            last_sentence = sentences[-1].split('\n')[-1].strip()
            if last_sentence and len(last_sentence) > 5:
                closings.append(last_sentence.lower())

    # Count most common
    common_closings = Counter(closings).most_common(10)

    return {
        'most_common': [item[0] for item in common_closings],
        'sample_count': len(closings),
    }


def extract_tone_patterns(texts: list, category: str) -> dict:
    """Extract tone-related patterns."""
    # Warm indicators
    warm_words = ['thank', 'appreciate', 'love', 'pleasure', 'delighted']
    warm_count = sum(1 for text in texts if any(word in text.lower() for word in warm_words))

    # Composed indicators
    composed_words = ['certainly', 'absolutely', 'understand', 'clarify', 'confirm']
    composed_count = sum(1 for text in texts if any(word in text.lower() for word in composed_words))

    # Defensive indicators (to avoid)
    defensive_words = ['sorry', 'apologise', 'regret', 'unfortunately']
    defensive_count = sum(1 for text in texts if any(word in text.lower() for word in defensive_words))

    return {
        'warm_percentage': round((warm_count / len(texts)) * 100, 1) if texts else 0,
        'composed_percentage': round((composed_count / len(texts)) * 100, 1) if texts else 0,
        'defensive_percentage': round((defensive_count / len(texts)) * 100, 1) if texts else 0,
        'sample_count': len(texts),
    }


def extract_phrasing_patterns(texts: list) -> dict:
    """Extract common phrasing patterns."""
    # Common Sagitine phrases
    phrases_to_check = [
        'box',  # Always "Box", never "drawer"
        'thank you for',
        'looking forward to',
        'please let us know',
        'be happy to',
    ]

    phrase_usage = {}
    for phrase in phrases_to_check:
        count = sum(1 for text in texts if phrase.lower() in text.lower())
        phrase_usage[phrase] = {
            'usage_count': count,
            'usage_percentage': round((count / len(texts)) * 100, 1) if texts else 0,
        }

    return phrase_usage


def extract_what_to_avoid(texts: list) -> list:
    """Extract phrases and patterns to avoid."""
    avoid_patterns = []

    # Check for over-apologetic language
    for text in texts:
        if 'sorry' in text.lower() or 'apologise' in text.lower() or 'regret' in text.lower():
            avoid_patterns.append({
                'type': 'over_apologetic',
                'example': text[:200] + '...' if len(text) > 200 else text,
            })

    # Check for uncertain language
    uncertainty_words = ['maybe', 'perhaps', 'possibly', 'might', 'could be']
    for text in texts:
        if any(word in text.lower() for word in uncertainty_words):
            avoid_patterns.append({
                'type': 'uncertain_language',
                'example': text[:200] + '...' if len(text) > 200 else text,
            })

    return avoid_patterns[:10]  # Limit to 10 examples


def extract_response_structure(texts: list) -> dict:
    """Analyze typical response structure."""
    avg_word_count = sum(len(text.split()) for text in texts) // len(texts) if texts else 0

    # Paragraph count
    paragraph_counts = [len(text.split('\n\n')) for text in texts]
    avg_paragraphs = sum(paragraph_counts) // len(paragraph_counts) if paragraph_counts else 0

    return {
        'avg_word_count': avg_word_count,
        'avg_paragraph_count': avg_paragraphs,
        'typical_length': 'short' if avg_word_count < 100 else 'medium' if avg_word_count < 200 else 'long',
    }


def extract_category_patterns(emails_by_category: dict) -> dict:
    """Extract patterns for each category."""
    patterns_by_category = {}

    for category, emails in emails_by_category.items():
        logger.info(f"  Extracting patterns for: {category}")

        if not emails:
            continue

        # Extract body texts
        texts = [email.get('clean_body', '') for email in emails]

        patterns_by_category[category] = {
            'response_structure': extract_response_structure(texts),
            'opening_patterns': extract_opening_patterns(texts),
            'closing_patterns': extract_closing_patterns(texts),
            'tone_patterns': extract_tone_patterns(texts, category),
            'phrasing_patterns': extract_phrasing_patterns(texts),
            'what_to_avoid': extract_what_to_avoid(texts),
            'sample_count': len(texts),
        }

    return patterns_by_category


def main():
    """Main pattern extraction entry point."""
    logger.info("🔍 Extracting patterns from classified emails")

    # Load classified emails
    classified_emails = load_json_files(FILTERED_DIR)

    if not classified_emails:
        logger.error(f"❌ No classified emails found in {FILTERED_DIR}")
        logger.info("   Run run_classification.py and filter first")
        sys.exit(1)

    logger.info(f"📊 Loaded {len(classified_emails)} classified emails")

    # Group by category
    emails_by_category = defaultdict(list)
    for email in classified_emails:
        category = email.get('category_primary', 'brand_feedback_general')
        emails_by_category[category].append(email)

    logger.info(f"   Found {len(emails_by_category)} categories")

    # Extract patterns for each category
    patterns = extract_category_patterns(emails_by_category)

    # Save patterns
    output_file = FILTERED_DIR / 'extracted_patterns.json'
    save_json(patterns, output_file)

    logger.info(f"✅ Pattern extraction complete!")
    logger.info(f"   Categories analysed: {len(patterns)}")
    logger.info(f"   Output: {output_file}")

    # Print summary
    print("\n📊 Pattern Summary:")
    for category, cat_patterns in patterns.items():
        print(f"\n  {category}:")
        print(f"    Samples:      {cat_patterns['sample_count']}")
        print(f"    Avg length:   {cat_patterns['response_structure']['typical_length']}")
        print(f"    Warm %:       {cat_patterns['tone_patterns']['warm_percentage']}%")
        print(f"    Composed %:   {cat_patterns['tone_patterns']['composed_percentage']}%")
        print(f"    Defensive %:  {cat_patterns['tone_patterns']['defensive_percentage']}%")


if __name__ == '__main__':
    main()
