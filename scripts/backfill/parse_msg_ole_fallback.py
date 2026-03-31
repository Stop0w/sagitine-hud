#!/usr/bin/env python3
"""
Alternative .msg parser using OleFileIO (more widely available).

FALLBACK: Use this if msg-extract fails to install.
"""

import sys
import json
from pathlib import Path
from datetime import datetime
import re

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import RAW_DATA_DIR, RAW_PARSED_DIR, CATEGORIES
from utils import logger, save_json, print_progress, PipelineStats


def parse_msg_file_ole(msg_path):
    """
    Parse .msg file using OleFileIO (fallback method).

    This is a simplified parser that extracts basic email data.
    """
    try:
        import olefile

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

        # Open .msg file as OLE storage
        ole = olefile.OleFileIO(str(msg_path))

        # Try to extract basic properties from __substg1.0_ streams
        # These are standard MAPI property streams

        # Extract subject (0x0037001A = PR_SUBJECT)
        try:
            if ole.exists('__substg1.0_0037001A'):
                result['subject'] = ole.openstream('__substg1.0_0037001A').read().decode('utf-16le', errors='ignore')
            else:
                result['subject'] = '(No Subject)'
        except:
            result['subject'] = '(No Subject)'

        # Extract sender name (0x0042001A = PR_SENT_REPRESENTING_NAME)
        try:
            if ole.exists('__substg1.0_0042001A'):
                result['sender_name'] = ole.openstream('__substg1.0_0042001A').read().decode('utf-16le', errors='ignore')
        except:
            pass

        # Extract sender email (0x0065001A = PR_SENT_REPRESENTING_EMAIL_ADDRESS)
        try:
            if ole.exists('__substg1.0_0065001A'):
                result['sender_email'] = ole.openstream('__substg1.0_0065001A').read().decode('utf-16le', errors='ignore')
        except:
            pass

        # Extract body (0x1000001A = PR_BODY)
        try:
            if ole.exists('__substg1.0_1000001A'):
                body_bytes = ole.openstream('__substg1.0_1000001A').read()
                result['raw_body'] = body_bytes.decode('utf-8', errors='ignore')
                result['clean_body'] = result['raw_body']
        except:
            pass

        ole.close()

        result['parse_status'] = 'success'
        result['parse_error'] = None

        # Use current time if date extraction failed
        if not result['received_at']:
            result['received_at'] = datetime.now().isoformat()

        # Extract order number
        search_text = result['subject'] + ' ' + result['clean_body']
        order_match = re.search(r'#?(\d{4,})', search_text)
        if order_match:
            result['order_number'] = order_match.group(1)

        return result

    except Exception as e:
        return {
            'source_filename': msg_path.name,
            'parse_status': 'error',
            'parse_error': str(e),
        }


def main():
    """Main parser entry point (OleFileIO fallback)."""
    logger.info("Using OleFileIO fallback parser")
    logger.info(f"   Input:  {RAW_DATA_DIR}")
    logger.info(f"   Output: {RAW_PARSED_DIR}")

    # Find all .msg files
    msg_files = list(RAW_DATA_DIR.glob('*.msg'))

    if not msg_files:
        logger.error(f"No .msg files found in {RAW_DATA_DIR}")
        sys.exit(1)

    logger.info(f"Found {len(msg_files)} .msg files")

    # Parse all files
    stats = PipelineStats()
    results = []

    for i, msg_file in enumerate(msg_files, 1):
        print_progress(i, len(msg_files), f"Parsing")

        result = parse_msg_file_ole(msg_file)
        results.append(result)

        if result['parse_status'] == 'success':
            stats.record_success()
        else:
            stats.record_error(f"{result['source_filename']}: {result['parse_error']}")

    # Separate successful and failed parses
    successful_emails = [r for r in results if r['parse_status'] == 'success']
    failed_emails = [r for r in results if r['parse_status'] == 'error']

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

    logger.info(f"Parse complete!")
    logger.info(f"   Success: {len(successful_emails)}")
    logger.info(f"   Errors:  {len(failed_emails)}")
    logger.info(f"   Output:  {RAW_PARSED_DIR}")


if __name__ == '__main__':
    main()
