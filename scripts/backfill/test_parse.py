#!/usr/bin/env python3
"""Test parsing a single .msg file to debug extraction issues."""

import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import RAW_DATA_DIR

try:
    from extract_msg import Message

    # Get first .msg file
    msg_files = list(RAW_DATA_DIR.glob('*.msg'))
    if not msg_files:
        print("[ERROR] No .msg files found")
        sys.exit(1)

    msg_file = msg_files[0]

    # Use ascii-safe filename for display
    safe_name = msg_file.name.encode('ascii', 'replace').decode('ascii')
    print(f"Testing file: {safe_name}")

    msg = Message(str(msg_file))

    print(f"\n[OK] Message opened successfully")

    # Handle unicode in subject
    subject = msg.subject or '(None)'
    safe_subject = subject.encode('ascii', 'replace').decode('ascii')
    print(f"  Subject: {safe_subject}")
    print(f"  Sender: {msg.sender}")
    print(f"  Date: {msg.date}")

    # Check body content
    print(f"\n[CHECK] Body content:")
    print(f"  Has HTML: {bool(msg.htmlBody)}")
    print(f"  Has RTF: {bool(msg.rtfBody)}")
    print(f"  Has Text: {bool(msg.body)}")

    if msg.htmlBody:
        html_len = len(msg.htmlBody)
        print(f"\n  HTML body found ({html_len} chars)")
        # msg.htmlBody is bytes, need to decode first
        if isinstance(msg.htmlBody, bytes):
            html_text = msg.htmlBody.decode('utf-8', errors='replace')
        else:
            html_text = msg.htmlBody
        safe_preview = html_text[:200].encode('ascii', 'replace').decode('ascii')
        print(f"  Preview: {safe_preview}")

    if msg.body:
        text_len = len(msg.body)
        print(f"\n  Text body found ({text_len} chars)")
        if isinstance(msg.body, bytes):
            body_text = msg.body.decode('utf-8', errors='replace')
        else:
            body_text = msg.body
        safe_preview = body_text[:200].encode('ascii', 'replace').decode('ascii')
        print(f"  Preview: {safe_preview}")

    # Check all available streams
    print(f"\n[DEBUG] Available properties:")
    print(f"  to: {msg.to}")
    print(f"  cc: {msg.cc}")
    print(f"  bcc: {msg.bcc}")

    msg.close()

except Exception as e:
    print(f"[ERROR] {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
