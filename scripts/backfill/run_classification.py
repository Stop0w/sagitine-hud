#!/usr/bin/env python3
"""
STEP 3: Classify cleaned emails.

Runs LLM classification (Claude API) OR stub mode.

Each output includes:
- category_primary
- category_secondary
- sentiment
- customer_intent
- tone_detected
- response_quality_score
- should_be_used_for_training
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    CLEANED_DIR, CLASSIFIED_DIR,
    CATEGORIES, SENTIMENTS, TONES,
    ENABLE_LLM_CLASSIFICATION, ANTHROPIC_API_KEY
)
from utils import (
    logger, save_json, load_json_files,
    print_progress, PipelineStats, truncate_text
)


# Stub classification rules (used when LLM is disabled)
STUB_CLASSIFICATION_RULES = {
    'keywords': {
        'damaged_missing_faulty': [
            'damaged', 'broken', 'cracked', 'faulty', 'defective',
            'missing', 'not received', 'arrived broken', 'does not work'
        ],
        'shipping_delivery_order_issue': [
            'delivery', 'shipping', 'tracking', 'shipped', 'delivery date',
            'arrived', 'dispatch', 'courier', ' australia post', 'tracking number'
        ],
        'product_usage_guidance': [
            'how to', 'how do i', 'instructions', 'setup', 'install',
            'use the', 'assemble', 'configuration', 'guide'
        ],
        'pre_purchase_question': [
            'before i buy', 'thinking of buying', 'interested in',
            'pre-order', 'does it have', 'can you tell me', 'considering'
        ],
        'return_refund_exchange': [
            'return', 'refund', 'exchange', 'change my mind',
            'not what i expected', 'send it back'
        ],
        'stock_availability': [
            'in stock', 'available', 'when will', 'out of stock',
            'back in stock', 'pre-order', 'waitlist'
        ],
        'partnership_wholesale_press': [
            'wholesale', 'partnership', 'collaboration', 'press',
            'inquiry', 'business', 'resell', 'stockist'
        ],
        'brand_feedback_general': [
            'love your', 'great design', 'beautiful', 'feedback',
            'suggestion', 'compliment', 'thought you might like'
        ],
    },
    'tone_keywords': {
        'warm_composed': ['thank you', 'appreciate', 'looking forward'],
        'professional_direct': ['please advise', 'clarify', 'confirm'],
        'empathetic_confident': ['understand', 'concern', 'assure'],
        'clarifying_helpful': ['help', 'guidance', 'explain'],
    }
}


def stub_classify_email(email_data: dict) -> dict:
    """
    Classify email using keyword-based stub rules.

    Used when ENABLE_LLM_CLASSIFICATION = False
    """
    text = (
        email_data.get('subject', '') + ' ' +
        email_data.get('clean_body', '')
    ).lower()

    # Determine primary category
    category_scores = {}
    for category, keywords in STUB_CLASSIFICATION_RULES['keywords'].items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            category_scores[category] = score

    # Select category with highest score
    if category_scores:
        category_primary = max(category_scores, key=category_scores.get)
    else:
        category_primary = 'brand_feedback_general'  # Default

    # Secondary category (none for stub)
    category_secondary = None

    # Sentiment based on keywords
    if any(word in text for word in ['love', 'great', 'beautiful', 'thank']):
        sentiment = 'positive'
    elif any(word in text for word in ['disappointed', 'frustrated', 'angry', 'terrible', 'worst']):
        sentiment = 'negative'
    elif any(word in text for word in ['urgent', 'asap', 'immediately', 'problem']):
        sentiment = 'critical'
    else:
        sentiment = 'neutral'

    # Customer intent summary (basic)
    customer_intent = f"Customer inquiry regarding {category_primary.replace('_', ' ')}"

    # Tone detection
    tone_scores = {}
    for tone, keywords in STUB_CLASSIFICATION_RULES['tone_keywords'].items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            tone_scores[tone] = score

    tone_detected = max(tone_scores, key=tone_scores.get) if tone_scores else 'warm_composed'

    # Response quality score (based on length and completeness)
    word_count = email_data.get('word_count', 0)
    if word_count > 100:
        response_quality_score = 9
    elif word_count > 50:
        response_quality_score = 8
    elif word_count > 20:
        response_quality_score = 7
    else:
        response_quality_score = 6

    # Should be used for training?
    should_be_used_for_training = (
        response_quality_score >= 7 and
        sentiment not in ['critical'] and
        word_count >= 20
    )

    return {
        'category_primary': category_primary,
        'category_secondary': category_secondary,
        'sentiment': sentiment,
        'customer_intent': customer_intent,
        'tone_detected': tone_detected,
        'response_quality_score': response_quality_score,
        'should_be_used_for_training': should_be_used_for_training,
        'classification_method': 'stub_keyword_matching',
        'confidence_score': 0.7,  # Stub has lower confidence
    }


def llm_classify_email(email_data: dict) -> dict:
    """
    Classify email using Claude API.

    Used when ENABLE_LLM_CLASSIFICATION = True
    """
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=ANTHROPIC_API_KEY)

        # Prepare prompt
        subject = email_data.get('subject', '')
        body = truncate_text(email_data.get('clean_body', ''), 2000)

        system_prompt = f"""You are a customer service classification AI for Sagitine, a premium storage brand.

CATEGORIES (use exactly these IDs):
{json.dumps(CATEGORIES, indent=2)}

SENTIMENTS:
{json.dumps(SENTIMENTS, indent=2)}

TONES:
{json.dumps(TONES, indent=2)}

TASK:
Classify the customer email and return ONLY valid JSON.

Your response must include:
- category_primary: one of the 8 categories above
- category_secondary: null or one of the categories above
- sentiment: one of the sentiments above
- customer_intent: brief 1-sentence summary
- tone_detected: one of the tones above
- response_quality_score: 1-10 (how complete/well-written is the email?)
- should_be_used_for_training: true if quality >= 8 and sentiment is not critical
- confidence_score: 0.0-1.0 (how confident are you in this classification?)

Return valid JSON only. No markdown, no explanation."""

        user_message = f"""CLASSIFY THIS EMAIL:

FROM: {email_data.get('sender_name', '')} <{email_data.get('sender_email', '')}>
SUBJECT: {subject}

BODY:
{body}

Respond with valid JSON only."""

        response = client.messages.create(
            model='claude-3-5-sonnet-20241022',
            max_tokens=1000,
            temperature=0.2,
            system=system_prompt,
            messages=[
                {'role': 'user', 'content': user_message}
            ]
        )

        # Extract JSON from response
        content = response.content[0].text

        # Remove markdown code blocks if present
        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            content = json_match.group(0)

        result = json.loads(content)
        result['classification_method'] = 'claude_llm'

        return result

    except Exception as e:
        logger.error(f"LLM classification failed: {e}")
        logger.info("Falling back to stub classification")
        return stub_classify_email(email_data)


def classify_email(email_data: dict) -> dict:
    """
    Classify email using LLM or stub mode.

    Routes to appropriate classification method based on config.
    """
    # Add metadata
    base_result = {
        'source_filename': email_data.get('source_filename'),
        'classification_timestamp': datetime.now().isoformat(),
    }

    # Choose classification method
    if ENABLE_LLM_CLASSIFICATION and ANTHROPIC_API_KEY:
        logger.debug("Using LLM classification")
        classification = llm_classify_email(email_data)
    else:
        logger.debug("Using stub classification (keyword matching)")
        classification = stub_classify_email(email_data)

    # Merge with base result
    return {**base_result, **classification}


def main():
    """Main classification entry point."""
    logger.info("🏷️  Starting email classification")
    logger.info(f"   Input:  {CLEANED_DIR}")
    logger.info(f"   Output: {CLASSIFIED_DIR}")
    logger.info(f"   Mode:   {'LLM (Claude API)' if ENABLE_LLM_CLASSIFICATION else 'STUB (keyword matching)'}")

    if ENABLE_LLM_CLASSIFICATION and not ANTHROPIC_API_KEY:
        logger.warning("⚠️  LLM enabled but ANTHROPIC_API_KEY not set")
        logger.warning("   Falling back to stub mode")

    # Load cleaned emails
    cleaned_emails = load_json_files(CLEANED_DIR)

    if not cleaned_emails:
        logger.error(f"❌ No cleaned emails found in {CLEANED_DIR}")
        logger.info("   Run clean_email.py first")
        sys.exit(1)

    logger.info(f"📊 Loaded {len(cleaned_emails)} cleaned emails")

    # Classify all emails
    stats = PipelineStats()
    classified_emails = []

    for i, email in enumerate(cleaned_emails, 1):
        print_progress(i, len(cleaned_emails), "Classifying")

        try:
            classification = classify_email(email)
            classified_emails.append(classification)

            if classification.get('should_be_used_for_training'):
                stats.record_success(classification.get('category_primary'))
            else:
                stats.record_filtered()
        except Exception as e:
            logger.error(f"Error classifying email {i}: {e}")
            stats.record_error(f"Email {i}: {e}")

    # Save classified emails
    logger.info(f"\n💾 Saving classified emails to {CLASSIFIED_DIR}")

    for email in classified_emails:
        filename = email.get('source_filename', f'classified_{hash(email)}.json')
        output_file = CLASSIFIED_DIR / f"{filename}.json"
        save_json(email, output_file)

    # Save combined output
    combined_output = {
        'total_classified': len(classified_emails),
        'classified_at': datetime.now().isoformat(),
        'classification_method': 'llm' if ENABLE_LLM_CLASSIFICATION else 'stub',
        'training_quality_count': sum(1 for e in classified_emails if e.get('should_be_used_for_training')),
        'avg_confidence': sum(e.get('confidence_score', 0) for e in classified_emails) / len(classified_emails) if classified_emails else 0,
        'emails': classified_emails,
    }

    combined_file = CLASSIFIED_DIR / 'all_classified_emails.json'
    save_json(combined_output, combined_file)

    # Save summary
    summary_file = CLASSIFIED_DIR / 'classify_summary.json'
    stats.save_summary(summary_file)

    # Print summary
    print(stats.get_summary())

    logger.info(f"✅ Classification complete!")
    logger.info(f"   Processed:        {len(classified_emails)} emails")
    logger.info(f"   Training quality:  {sum(1 for e in classified_emails if e.get('should_be_used_for_training'))}")
    logger.info(f"   Output:           {CLASSIFIED_DIR}")


if __name__ == '__main__':
    main()
