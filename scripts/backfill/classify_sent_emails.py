#!/usr/bin/env python3
"""
STEP 2: Classify SENT emails (outbound responses).

For each sent email:
1. Categorize by type (shipping, product_usage, pre_purchase, etc.)
2. Infer customer's question from context
3. Extract CX team's response as the gold template
4. Score response quality (1-10)
"""

import sys
import re
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import CATEGORIES, CATEGORY_LABELS, CLASSIFIED_DIR
from utils import logger, save_json, load_json


def classify_email_category(subject: str, body: str) -> str:
    """
    Classify email into category using keyword matching (stub mode).

    Categories: shipping_delivery, product_usage, pre_purchase, etc.
    """
    text = (subject + ' ' + body).lower()

    # Define keyword patterns for each category
    category_patterns = {
        'stock_availability': [
            r'stock', r'out of stock', r'available', r'restock', r'sold out',
            r'back in stock', r'pre-order', r'waitlist', r'inventory'
        ],
        'shipping_delivery_order_issue': [
            r'ship', r'delivery', r'arriv', r'track', r'courier', r'address',
            r'package', r'parcel', r'postal', r'dispatch', r'transit'
        ],
        'damaged_missing_faulty': [
            r'damag', r'broken', r'faulty', r'defect', r'missing', r'replace',
            r'crack', r'scratched', r'issue', r'problem', r'wrong item'
        ],
        'product_usage_guidance': [
            r'how to', r'use', r'assemble', r'install', r'instruction',
            r'manual', r'guide', r'help with', r'setup', r'fit'
        ],
        'pre_purchase_question': [
            r'before.*order', r'prior.*order', r'question.*before',
            r'interested.*but', r'considering.*purchase', r'thinking.*buy'
        ],
        'return_refund_exchange': [
            r'return', r'refund', r'exchange', r'send back', r'not happy',
            r'changed.*mind', r'wrong.*size', r'doesn\'t fit'
        ],
        'partnership_wholesale_press': [
            r'wholesale', r'partnership', r'collaborat', r'press', r'media',
            r'retailer', r'stockist', r'b2b', r'trade'
        ],
        'brand_feedback_general': [
            r'feedback', r'review', r'love.*product', r'compliment', r'thank',
            r'great.*service', r'amazing'
        ],
    }

    # Count matches for each category
    category_scores = {}
    for category, patterns in category_patterns.items():
        score = 0
        for pattern in patterns:
            matches = len(re.findall(pattern, text))
            score += matches
        category_scores[category] = score

    # Return category with highest score (or default to stock_availability)
    best_category = max(category_scores, key=category_scores.get)

    if category_scores[best_category] == 0:
        # No keywords matched - infer from pre-order patterns
        if re.search(r'pre-order|update.*order|order.*update', text):
            return 'stock_availability'

    return best_category


def infer_customer_question(subject: str, body: str, category: str) -> str:
    """
    Infer the customer's question from the CX response.

    For sent emails, we need to reverse-engineer what the customer asked.
    """
    question_templates = {
        'stock_availability': [
            "When will my order ship?",
            "What's the status of my pre-order?",
            "When will this be back in stock?",
            "How long is the wait for this item?",
        ],
        'shipping_delivery_order_issue': [
            "Where is my order?",
            "When will my order arrive?",
            "Can you track my package?",
            "Why hasn't my order shipped yet?",
        ],
        'damaged_missing_faulty': [
            "My item arrived damaged",
            "I received a faulty product",
            "Part of my order is missing",
            "What should I do about a broken item?",
        ],
        'product_usage_guidance': [
            "How do I assemble this?",
            "What's the best way to use this?",
            "Can you explain how to set this up?",
            "I need help with using this product",
        ],
        'pre_purchase_question': [
            "I have a question before ordering",
            "Can you tell me about this product?",
            "What's included in the set?",
            "Is this suitable for my needs?",
        ],
        'return_refund_exchange': [
            "How do I return this?",
            "Can I get a refund?",
            "I want to exchange my purchase",
            "What's your return policy?",
        ],
        'partnership_wholesale_press': [
            "Do you offer wholesale pricing?",
            "Are you looking for retail partners?",
            "Can we collaborate?",
            "I'd like to stock your products",
        ],
        'brand_feedback_general': [
            "I just wanted to share my feedback",
            "I love your products",
            "Great customer service",
            "Thank you for the help",
        ],
    }

    # Look for context clues in the response
    text = (subject + ' ' + body).lower()

    # Check for specific indicators
    if 'pre-order' in text or 'update on your pre-order' in text:
        return "What's the status of my pre-order?"

    if 'ship next week' in text or 'on track to ship' in text:
        return "When will my order ship?"

    if 'assemble' in text or 'set up' in text:
        return "How do I assemble/set up my Box?"

    if 'damaged' in body.lower() or 'broken' in body.lower():
        return "What should I do about my damaged item?"

    # Default to category-specific template
    if category in question_templates:
        return question_templates[category][0]

    return "General customer inquiry"


def score_response_quality(body: str) -> int:
    """
    Score response quality (1-10).

    Criteria:
    - Clarity (is it easy to understand?)
    - Completeness (does it answer the question?)
    - Tone (is it warm, composed, confident?)
    - Sagitine brand alignment (uses "Box" not "drawer")
    """
    score = 5  # Base score
    text_lower = body.lower()

    # Positive indicators
    if 'hi ' in body.lower()[:50]:  # Personal greeting
        score += 1

    if len(body) > 100 and len(body) < 2000:  # Appropriate length
        score += 1

    if 'box' in text_lower:  # Correct terminology
        score += 1

    if 'drawer' in text_lower:  # WRONG terminology
        score -= 2

    if 'sorry' in text_lower or 'apologise' in text_lower or 'apologize' in text_lower:
        score -= 1  # Over-apologetic

    if 'thank' in text_lower or 'thanks' in text_lower:
        score += 1  # Gratitude

    if re.search(r'\?|\.', body[-50:]):  # Proper ending
        score += 1

    # Check for warm, composed tone
    warm_phrases = ['hope you', 'please let', 'happy to', 'love to']
    if any(phrase in text_lower for phrase in warm_phrases):
        score += 1

    return min(10, max(1, score))


def classify_sent_email(email: Dict[str, Any]) -> Dict[str, Any]:
    """Classify a single sent email."""
    subject = email.get('subject', '')
    body = email.get('clean_body', '')

    # Classify category
    category = classify_email_category(subject, body)

    # Infer customer question
    customer_question = infer_customer_question(subject, body, category)

    # Score response quality
    quality_score = score_response_quality(body)

    # Extract response template (the body is the response)
    response_template = body.strip()

    return {
        'source_filename': email.get('source_filename'),
        'subject': subject,
        'category': category,
        'customer_question': customer_question,
        'response_body': response_template,
        'response_quality_score': quality_score,
        'sent_at': email.get('sent_at'),
        'word_count': len(body.split()),
        'char_count': len(body),
    }


def main():
    """Main classification entry point."""
    logger.info("Classifying SENT emails (outbound responses)")

    # Load parsed emails
    parsed_file = Path(__file__).parent.parent.parent / 'data' / 'raw_parsed' / 'all_parsed_emails.json'

    if not parsed_file.exists():
        logger.error(f"Parsed emails file not found: {parsed_file}")
        logger.info("Run parse_msg_simple.py first")
        sys.exit(1)

    data = load_json(parsed_file)
    emails = data.get('emails', [])

    logger.info(f"Loaded {len(emails)} parsed emails")

    # Filter only successful parses
    successful_emails = [e for e in emails if e.get('parse_status') == 'success']
    logger.info(f"Successfully parsed: {len(successful_emails)}")

    if not successful_emails:
        logger.error("No successfully parsed emails found")
        sys.exit(1)

    # Classify each email
    classified = []
    for i, email in enumerate(successful_emails, 1):
        if i % 100 == 0:
            logger.info(f"  Classified {i}/{len(successful_emails)} emails...")

        classified_email = classify_sent_email(email)
        classified.append(classified_email)

    # Save results
    output_file = CLASSIFIED_DIR / 'classified_sent_emails.json'
    save_json(classified, output_file)

    logger.info(f"\n[OK] Classification complete")
    logger.info(f"  Total classified: {len(classified)}")
    logger.info(f"  Output: {output_file}")

    # Print category breakdown
    category_counts = {}
    for email in classified:
        cat = email.get('category', 'unknown')
        category_counts[cat] = category_counts.get(cat, 0) + 1

    logger.info(f"\nCategory breakdown:")
    for cat, count in sorted(category_counts.items()):
        label = CATEGORY_LABELS.get(cat, cat)
        logger.info(f"  {label}: {count}")

    # Print quality score distribution
    high_quality = [e for e in classified if e.get('response_quality_score', 0) >= 8]
    logger.info(f"\nQuality scores:")
    logger.info(f"  High quality (8+): {len(high_quality)}/{len(classified)}")
    logger.info(f"  Retention rate: {len(high_quality)/len(classified)*100:.1f}%")


if __name__ == '__main__':
    main()
