#!/usr/bin/env python3
"""
STEP 2: Clean parsed email data.

Removes:
- Email signatures
- Email threads/chains
- Excessive whitespace
- HTML artifacts

Preserves meaning while preparing for classification.
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import RAW_PARSED_DIR, CLEANED_DIR
from utils import (
    logger, save_json, load_json_files,
    clean_whitespace, remove_email_signatures,
    remove_email_threads, print_progress, PipelineStats
)


def clean_email_body(raw_body: str) -> str:
    """
    Clean email body while preserving meaning.

    Process:
    1. Remove HTML artifacts
    2. Remove email signatures
    3. Remove email threads
    4. Clean whitespace
    """
    if not raw_body:
        return ""

    text = raw_body

    # Remove email signatures first
    text = remove_email_signatures(text)

    # Remove email threads/history
    text = remove_email_threads(text)

    # Clean whitespace
    text = clean_whitespace(text)

    return text


def clean_email_data(email_data: dict) -> dict:
    """
    Clean a single email record.

    Returns cleaned dict with:
    - All original fields preserved
    - clean_body properly cleaned
    - word_count added
    - has_order_number added
    """
    cleaned = email_data.copy()

    # Clean the body
    cleaned['clean_body'] = clean_email_body(email_data.get('clean_body', ''))

    # Add metadata
    cleaned['word_count'] = len(cleaned['clean_body'].split()) if cleaned['clean_body'] else 0

    # Check for order number
    cleaned['has_order_number'] = bool(email_data.get('order_number'))

    # Add cleaning timestamp
    cleaned['cleaned_at'] = datetime.now().isoformat()

    return cleaned


def main():
    """Main cleaning entry point."""
    logger.info("🧹 Starting email cleaning")
    logger.info(f"   Input:  {RAW_PARSED_DIR}")
    logger.info(f"   Output: {CLEANED_DIR}")

    # Load all parsed emails
    parsed_emails = load_json_files(RAW_PARSED_DIR)

    if not parsed_emails:
        logger.error(f"❌ No parsed emails found in {RAW_PARSED_DIR}")
        logger.info("   Run parse_msg.py first")
        sys.exit(1)

    logger.info(f"📊 Loaded {len(parsed_emails)} parsed emails")

    # Clean all emails
    stats = PipelineStats()
    cleaned_emails = []

    for i, email in enumerate(parsed_emails, 1):
        print_progress(i, len(parsed_emails), "Cleaning")

        try:
            cleaned = clean_email_data(email)
            cleaned_emails.append(cleaned)
            stats.record_success()
        except Exception as e:
            logger.error(f"Error cleaning email {i}: {e}")
            stats.record_error(f"Email {i}: {e}")

    # Save cleaned emails
    logger.info(f"\n💾 Saving cleaned emails to {CLEANED_DIR}")

    for email in cleaned_emails:
        # Use original filename if available
        filename = email.get('source_filename', f'email_{hash(email)}.json')
        output_file = CLEANED_DIR / f"{filename}.json"
        save_json(email, output_file)

    # Save combined output
    combined_output = {
        'total_cleaned': len(cleaned_emails),
        'cleaned_at': datetime.now().isoformat(),
        'avg_word_count': sum(e.get('word_count', 0) for e in cleaned_emails) // len(cleaned_emails) if cleaned_emails else 0,
        'has_order_number_count': sum(1 for e in cleaned_emails if e.get('has_order_number')),
        'emails': cleaned_emails,
    }

    combined_file = CLEANED_DIR / 'all_cleaned_emails.json'
    save_json(combined_output, combined_file)

    # Save summary
    summary_file = CLEANED_DIR / 'clean_summary.json'
    stats.save_summary(summary_file)

    # Print summary
    print(stats.get_summary())

    logger.info(f"✅ Cleaning complete!")
    logger.info(f"   Processed: {len(cleaned_emails)} emails")
    logger.info(f"   Output:    {CLEANED_DIR}")


if __name__ == '__main__':
    main()
