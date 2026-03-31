#!/usr/bin/env python3
"""
Parse Outlook .msg files using extract-msg library.

Handles sent emails (outbound responses) and extracts:
- Subject
- Sender (from)
- Recipient (to)
- Body (HTML/RTF/plain text)
- Date sent
"""

import sys
import re
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# Try to import extract-msg
try:
    from extract_msg import Message
    EXTRACT_MSG_AVAILABLE = True
except ImportError:
    EXTRACT_MSG_AVAILABLE = False
    print("[ERROR] extract-msg library not installed. Run: pip install extract-msg")


def clean_html_body(html_content: str) -> str:
    """
    Extract clean text from HTML email body.
    Removes HTML tags, signatures, etc.
    """
    if not html_content:
        return ""

    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_content)

    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)

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


def extract_customer_question(email_body: str, subject: str) -> str:
    """
    Infer customer's question from outbound response email.

    Looks for:
    1. Quoted text (customer's original message)
    2. "Re:" or "FW:" in subject
    3. Context clues in response (e.g., "Regarding your question about...")
    """
    question_indicators = [
        r'You asked[:\s]+(.*?)(?:\.|\\n)',
        r'You were wondering[:\s]+(.*?)(?:\.|\\n)',
        r'You mentioned[:\s]+(.*?)(?:\.|\\n)',
        r'Regarding your question[:\s]+(.*?)(?:\.|\\n)',
        r'You wrote[:\s]+(.*?)(?:\.|\\n)',
    ]

    # Try to find quoted text (customer's original message)
    quoted_pattern = r'From:.*?Sent:.*?To:.*?Subject:.*?\\n(.*?)(?=\\nFrom:|$)'
    quoted_matches = re.findall(quoted_pattern, email_body, re.DOTALL)

    if quoted_matches:
        # Return the first quoted text (customer's message)
        return quoted_matches[0].strip()[:500]

    # Try to find question indicators in body
    for pattern in question_indicators:
        match = re.search(pattern, email_body, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()[:500]

    # Infer from subject (if it's "Re: something")
    if subject.startswith('Re:'):
        inferred_question = subject[3:].strip()
        return f"Regarding: {inferred_question}"

    # If no clear question found, return generic
    return "[Customer question could not be inferred from context]"


def extract_order_number(text: str) -> str:
    """Extract order number from text."""
    patterns = [
        r'order\s*#?:?\s*(\d{4,})',
        r'#(\d{4,})',
        r'order[:\s]+(\w{2,}?\d{4,})',
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)

    return None


def parse_msg_file(msg_path: Path) -> Dict[str, Any]:
    """
    Parse a single .msg file using extract-msg library.

    Returns dict with email data.
    """
    result = {
        'source_filename': msg_path.name,
        'sender_name': '',
        'sender_email': '',
        'recipient_name': '',
        'recipient_email': '',
        'subject': '',
        'raw_body': '',
        'clean_body': '',
        'sent_at': None,
        'order_number': None,
        'customer_question': '',
        'response_body': '',
        'parse_status': 'error',
        'parse_error': None,
    }

    if not EXTRACT_MSG_AVAILABLE:
        result['parse_error'] = 'extract-msg library not installed'
        return result

    try:
        # Open the .msg file
        msg = Message(str(msg_path))

        # Extract subject
        result['subject'] = msg.subject or '(No Subject)'

        # Extract sender (from - should be Sagitine email for sent items)
        try:
            if msg.sender:
                # Sender might be string or object
                if isinstance(msg.sender, str):
                    result['sender_name'] = msg.sender
                    result['sender_email'] = msg.sender
                elif hasattr(msg.sender, 'name'):
                    result['sender_name'] = msg.sender.name or ''
                    result['sender_email'] = msg.sender.email_address or ''
                else:
                    result['sender_name'] = str(msg.sender)
                    result['sender_email'] = str(msg.sender)
        except Exception as e:
            result['sender_name'] = ''
            result['sender_email'] = ''

        # Extract recipient (to - should be customer for sent items)
        try:
            if msg.to and len(msg.to) > 0:
                recipient = msg.to[0]
                # Recipient might be string or object
                if isinstance(recipient, str):
                    result['recipient_name'] = recipient
                    result['recipient_email'] = recipient
                elif hasattr(recipient, 'name'):
                    result['recipient_name'] = recipient.name or ''
                    result['recipient_email'] = recipient.email_address or ''
                else:
                    result['recipient_name'] = str(recipient)
                    result['recipient_email'] = str(recipient)
        except Exception as e:
            result['recipient_name'] = ''
            result['recipient_email'] = ''

        # Extract date sent
        if msg.date:
            result['sent_at'] = msg.date.isoformat()

        # Extract body (try HTML first, then plain text)
        body_html = msg.htmlBody or b''
        body_text = msg.body or b''

        # Handle bytes vs strings
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

        # For sent emails, the response is the clean body
        result['response_body'] = result['clean_body']

        # Infer customer question from context
        if result['clean_body']:
            result['customer_question'] = extract_customer_question(
                result['clean_body'],
                result['subject']
            )

        # Extract order number
        search_text = result['subject'] + ' ' + result['clean_body']
        result['order_number'] = extract_order_number(search_text)

        result['parse_status'] = 'success'
        result['parse_error'] = None

        # Close message
        msg.close()

    except Exception as e:
        result['parse_status'] = 'error'
        result['parse_error'] = str(e)

    return result


def main():
    """Main entry point for parsing .msg files."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent))

    from config import RAW_DATA_DIR, DATA_DIR
    from utils import logger, save_json

    logger.info("Parsing Outlook .msg files (SENT EMAILS)")

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
    if emails:
        sample = emails[0]
        logger.info(f"\nSample parsed email:")
        logger.info(f"  Subject: {sample.get('subject', 'N/A')[:60]}")
        logger.info(f"  From: {sample.get('sender_name', 'N/A')}")
        logger.info(f"  To: {sample.get('recipient_name', 'N/A')}")
        logger.info(f"  Body length: {len(sample.get('clean_body', ''))} chars")
        if sample.get('customer_question'):
            logger.info(f"  Inferred question: {sample['customer_question'][:80]}...")


if __name__ == '__main__':
    main()
