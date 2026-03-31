#!/usr/bin/env python3
"""
STEP 1: Parse .msg files from Outlook.

Extracts structured data from .msg files:
- subject
- sender
- date
- body
- source file

Handles failures gracefully with detailed error logging.
"""

import sys
import json
from pathlib import Path
from datetime import datetime
from dateutil import parser as date_parser

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import RAW_DATA_DIR, RAW_PARSED_DIR, CATEGORIES
from utils import logger, save_json, print_progress, PipelineStats


def extract_msg_body(msg):
    """
    Extract email body from .msg file.

    Handles HTML, RTF, and plain text formats with fallback.
    """
    # Try plain text first
    if hasattr(msg, 'body') and msg.body:
        return msg.body

    # Try HTML
    if hasattr(msg, 'htmlBody') and msg.htmlBody:
        # Strip HTML tags for clean text (basic approach)
        import re
        text = re.sub(r'<[^>]+>', ' ', msg.htmlBody)
        # Clean up multiple spaces
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    # Fallback to empty string
    return ""


def clean_email_address(email_string):
    """
    Extract clean email address from various formats.

    Handles:
    - "Name <email>"
    - "email"
    - "Name [email]"
    """
    import re

    if not email_string:
        return ""

    # Try to extract email from angle brackets
    match = re.search(r'<([^>]+)>', email_string)
    if match:
        return match.group(1).strip()

    # Try square brackets
    match = re.search(r'\[([^\]]+)\]', email_string)
    if match:
        return match.group(1).strip()

    # Return as-is if it looks like an email
    if '@' in str(email_string):
        return str(email_string).strip()

    return ""


def extract_sender_name(msg):
    """Extract sender name, fallback to email if no name."""
    # Try senderName field
    if hasattr(msg, 'senderName') and msg.senderName:
        return msg.senderName

    # Try to parse from sender string
    if hasattr(msg, 'sender') and msg.sender:
        sender_str = str(msg.sender)
        # Extract name from "Name <email>" format
        import re
        match = re.match(r'^([^<]+)<', sender_str)
        if match:
            return match.group(1).strip()

    return ""


def parse_msg_file(msg_path):
    """
    Parse a single .msg file and extract structured data.

    Returns dict with:
    - source_filename
    - sender_name
    - sender_email
    - subject
    - raw_body
    - clean_body
    - received_at
    - order_number
    - parse_status
    - parse_error
    """
    from msgextract import msg

    result = {
        'source_filename': msg_path.name,
        'sender_name': '',
        'sender_email': '',
        'subject': '',
        'raw_body': '',
        'clean_body': '',
        'received_at': None,
        'order_number': None,
        'parse_status': 'error',
        'parse_error': None,
    }

    try:
        email = msg.Message(str(msg_path))

        # Extract sender
        result['sender_name'] = extract_sender_name(email)
        sender_email_str = getattr(email, 'senderEmailAddress', '') or ''
        result['sender_email'] = clean_email_address(sender_email_str)

        # Extract date
        date_str = getattr(email, 'date', '')
        if date_str:
            try:
                parsed_date = date_parser.parse(date_str)
                result['received_at'] = parsed_date.isoformat()
            except Exception as e:
                logger.warning(f"Could not parse date '{date_str}' in {msg_path.name}: {e}")
                result['received_at'] = datetime.now().isoformat()
        else:
            result['received_at'] = datetime.now().isoformat()

        # Extract subject
        result['subject'] = getattr(email, 'subject', '') or '(No Subject)'

        # Extract body
        result['raw_body'] = extract_msg_body(email)

        # Clean body (basic cleaning)
        if result['raw_body']:
            result['clean_body'] = result['raw_body']
        else:
            result['clean_body'] = ''

        # Extract order number if present
        import re
        search_text = result['subject'] + ' ' + result['clean_body']
        order_match = re.search(r'#?(\d{4,})', search_text)
        if order_match:
            result['order_number'] = order_match.group(1)

        result['parse_status'] = 'success'
        result['parse_error'] = None

    except Exception as e:
        result['parse_status'] = 'error'
        result['parse_error'] = str(e)
        logger.error(f"Error parsing {msg_path.name}: {e}")

    return result


def main():
    """Main parser entry point."""
    logger.info("🔍 Starting .msg file parser")
    logger.info(f"   Input:  {RAW_DATA_DIR}")
    logger.info(f"   Output: {RAW_PARSED_DIR}")

    # Find all .msg files
    msg_files = list(RAW_DATA_DIR.glob('*.msg'))

    if not msg_files:
        logger.error(f"❌ No .msg files found in {RAW_DATA_DIR}")
        sys.exit(1)

    logger.info(f"📊 Found {len(msg_files)} .msg files")

    # Parse all files
    stats = PipelineStats()
    results = []

    for i, msg_file in enumerate(msg_files, 1):
        print_progress(i, len(msg_files), f"Parsing")

        result = parse_msg_file(msg_file)
        results.append(result)

        if result['parse_status'] == 'success':
            stats.record_success()
        else:
            stats.record_error(f"{result['source_filename']}: {result['parse_error']}")

    # Separate successful and failed parses
    successful_emails = [r for r in results if r['parse_status'] == 'success']
    failed_emails = [r for r in results if r['parse_status'] == 'error']

    # Output results as individual JSON files (for easy debugging)
    logger.info(f"\n💾 Saving parsed emails to {RAW_PARSED_DIR}")

    for email in successful_emails:
        output_file = RAW_PARSED_DIR / f"{email['source_filename']}.json"
        save_json(email, output_file)

    # Save combined output
    combined_output = {
        'total_files': len(msg_files),
        'success_count': len(successful_emails),
        'error_count': len(failed_emails),
        'parsed_at': datetime.now().isoformat(),
        'emails': successful_emails,
        'errors': failed_emails,
    }

    combined_file = RAW_PARSED_DIR / 'all_parsed_emails.json'
    save_json(combined_output, combined_file)

    # Save summary
    summary_file = RAW_PARSED_DIR / 'parse_summary.json'
    stats.save_summary(summary_file)

    # Print summary
    print(stats.get_summary())

    logger.info(f"✅ Parsing complete!")
    logger.info(f"   Success: {len(successful_emails)}")
    logger.info(f"   Errors:  {len(failed_emails)}")
    logger.info(f"   Output:  {RAW_PARSED_DIR}")


if __name__ == '__main__':
    main()
