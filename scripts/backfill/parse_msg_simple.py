#!/usr/bin/env python3
"""
Simplified Outlook .msg parser - focuses on extracting body content only.

For sent emails (outbound responses), we mainly need:
- Subject
- Response body
- Sent date

Customer inference will happen during knowledge generation.
"""

import sys
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

try:
    from extract_msg import Message
except ImportError:
    print("[ERROR] extract-msg not installed. Run: pip install extract-msg")
    sys.exit(1)


def clean_html_body(html_content: str) -> str:
    """Extract clean text from HTML email body."""
    if not html_content:
        return ""

    # Remove CSS styles and script content FIRST (before removing tags)
    html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<head[^>]*>.*?</head>', '', html_content, flags=re.DOTALL | re.IGNORECASE)

    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_content)

    # Remove common HTML artifacts
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&quot;', '"', text)

    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)

    # Remove CSS artifacts by finding where the actual email content starts
    # Look for common greetings and remove everything before that
    greeting_patterns = [
        r'(Hi\s+\w+)',
        r'(Hello\s+\w+)',
        r'(Dear\s+\w+)',
        r'(Good\s+(?:morning|afternoon|evening))',
    ]

    for pattern in greeting_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            text = match.group(1) + ' ' + text[match.end():]
            break

    # Remove common signature patterns
    signature_patterns = [
        r'--\s*Best regards,.*',
        r'Kind regards,.*',
        r'Cheers,.*',
        r'Thanks,.*',
        r'Sent from my.*',
        r'_____*$',
    ]

    for pattern in signature_patterns:
        text = re.sub(pattern, '', text, flags=re.DOTALL | re.IGNORECASE)

    # Clean up
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    clean_text = ' '.join(lines)

    return clean_text.strip()


def parse_msg_file(msg_path: Path) -> Dict[str, Any]:
    """Parse .msg file - extract subject, body, date."""
    result = {
        'source_filename': msg_path.name,
        'subject': '',
        'raw_body': '',
        'clean_body': '',
        'sent_at': None,
        'parse_status': 'error',
        'parse_error': None,
    }

    try:
        msg = Message(str(msg_path))

        # Extract subject
        result['subject'] = msg.subject or '(No Subject)'

        # Extract date
        if msg.date:
            result['sent_at'] = msg.date.isoformat()

        # Extract body (prefer HTML, fallback to text)
        body_html = msg.htmlBody or b''
        body_text = msg.body or b''

        # Handle bytes
        if body_html:
            if isinstance(body_html, bytes):
                body_html = body_html.decode('utf-8', errors='replace')
            result['raw_body'] = body_html
            result['clean_body'] = clean_html_body(body_html)
        elif body_text:
            if isinstance(body_text, bytes):
                body_text = body_text.decode('utf-8', errors='replace')
            result['raw_body'] = body_text
            result['clean_body'] = body_text.strip()

        result['parse_status'] = 'success'
        result['parse_error'] = None

        msg.close()

    except Exception as e:
        result['parse_status'] = 'error'
        result['parse_error'] = f"{type(e).__name__}: {str(e)}"

    return result


def main():
    """Main entry point."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent))

    from config import RAW_DATA_DIR, DATA_DIR
    from utils import logger, save_json

    logger.info("Parsing Outlook .msg files (SIMPLE MODE)")

    # Find all .msg files
    msg_files = list(RAW_DATA_DIR.glob('*.msg'))
    logger.info(f"Found {len(msg_files)} .msg files")

    if not msg_files:
        logger.error("No .msg files found")
        sys.exit(1)

    # Parse all files
    emails = []
    success_count = 0
    error_count = 0

    for i, msg_file in enumerate(msg_files, 1):
        if i % 100 == 0:
            logger.info(f"  Parsed {i}/{len(msg_files)} files...")

        result = parse_msg_file(msg_file)
        emails.append(result)

        if result['parse_status'] == 'success':
            success_count += 1
        else:
            error_count += 1

    # Save results
    output = {
        'total_files': len(msg_files),
        'success_count': success_count,
        'error_count': error_count,
        'parsed_at': datetime.now().isoformat(),
        'emails': emails,
    }

    output_file = DATA_DIR / 'raw_parsed' / 'all_parsed_emails.json'
    save_json(output, output_file)

    logger.info(f"[OK] Parsing complete")
    logger.info(f"  Success: {success_count}")
    logger.info(f"  Errors:  {error_count}")
    logger.info(f"  Output:  {output_file}")

    # Show sample
    if success_count > 0:
        successful = [e for e in emails if e['parse_status'] == 'success']
        sample = successful[0]
        logger.info(f"\nSample parsed email:")
        logger.info(f"  Subject: {sample.get('subject', 'N/A')[:60]}")
        logger.info(f"  Body length: {len(sample.get('clean_body', ''))} chars")


if __name__ == '__main__':
    main()
