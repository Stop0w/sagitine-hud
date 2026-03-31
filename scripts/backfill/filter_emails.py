#!/usr/bin/env python3
"""
STEP 4: Filter classified emails by quality.

Keeps only:
- response_quality_score >= 8
- should_be_used_for_training = true

Saves to: data/filtered/
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import CLASSIFIED_DIR, FILTERED_DIR, MIN_RESPONSE_QUALITY_SCORE
from utils import logger, save_json, load_json_files, print_progress, PipelineStats


def filter_email(email_data: dict) -> bool:
    """
    Determine if email should be kept for training.

    Criteria:
    - response_quality_score >= 8
    - should_be_used_for_training = true
    """
    quality_score = email_data.get('response_quality_score', 0)
    should_use = email_data.get('should_be_used_for_training', False)

    return quality_score >= MIN_RESPONSE_QUALITY_SCORE and should_use


def main():
    """Main filtering entry point."""
    logger.info("🔍 Filtering classified emails by quality")
    logger.info(f"   Input:  {CLASSIFIED_DIR}")
    logger.info(f"   Output: {FILTERED_DIR}")
    logger.info(f"   Min quality score: {MIN_RESPONSE_QUALITY_SCORE}")

    # Load classified emails
    classified_emails = load_json_files(CLASSIFIED_DIR)

    if not classified_emails:
        logger.error(f"❌ No classified emails found in {CLASSIFIED_DIR}")
        logger.info("   Run run_classification.py first")
        sys.exit(1)

    logger.info(f"📊 Loaded {len(classified_emails)} classified emails")

    # Filter emails
    stats = PipelineStats()
    filtered_emails = []

    for i, email in enumerate(classified_emails, 1):
        print_progress(i, len(classified_emails), "Filtering")

        if filter_email(email):
            filtered_emails.append(email)
            stats.record_success(email.get('category_primary'))
        else:
            stats.record_filtered()

    # Save filtered emails
    logger.info(f"\n💾 Saving filtered emails to {FILTERED_DIR}")

    for email in filtered_emails:
        filename = email.get('source_filename', f'filtered_{hash(email)}.json')
        output_file = FILTERED_DIR / f"{filename}.json"
        save_json(email, output_file)

    # Save combined output
    combined_output = {
        'total_classified': len(classified_emails),
        'total_filtered': len(filtered_emails),
        'filter_criteria': {
            'min_quality_score': MIN_RESPONSE_QUALITY_SCORE,
            'must_be_training_quality': True,
        },
        'filtered_at': datetime.now().isoformat(),
        'retention_rate': round((len(filtered_emails) / len(classified_emails)) * 100, 1) if classified_emails else 0,
        'emails': filtered_emails,
    }

    combined_file = FILTERED_DIR / 'all_filtered_emails.json'
    save_json(combined_output, combined_file)

    # Save summary
    summary_file = FILTERED_DIR / 'filter_summary.json'
    stats.save_summary(summary_file)

    # Print summary
    print(stats.get_summary())

    logger.info(f"✅ Filtering complete!")
    logger.info(f"   Input:    {len(classified_emails)} classified emails")
    logger.info(f"   Output:   {len(filtered_emails)} training-quality emails")
    logger.info(f"   Retained: {combined_output['retention_rate']}%")


if __name__ == '__main__':
    main()
