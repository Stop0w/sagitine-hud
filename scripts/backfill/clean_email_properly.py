#!/usr/bin/env python3
"""
PROPER email cleaning - removes ALL artifacts for production-ready outputs.
"""

import re
from typing import Dict, Any


def clean_response_body(body: str) -> str:
    """
    Thoroughly clean email body for production use.

    Removes:
    - VML/Outlook CSS tags
    - HTML entities
    - Email signatures
    - Forwarded chains
    - Headers
    - Internal-only content
    """

    if not body:
        return ""

    # Remove VML and Outlook CSS
    body = re.sub(r'v:\\?\*[^}]*\}', '', body)
    body = re.sub(r'o:\\?\*[^}]*\}', '', body)
    body = re.sub(r'w:\\?\*[^}]*\}', '', body)
    body = re.sub(r'\.shape[^}]*\}', '', body)
    body = re.sub(r'style[^}]*\{[^}]*\}', '', body, flags=re.DOTALL | re.IGNORECASE)

    # Remove HTML tags
    body = re.sub(r'<[^>]+>', ' ', body)

    # Remove HTML entities
    body = re.sub(r'&nbsp;', ' ', body)
    body = re.sub(r'&#8217;', "'", body)
    body = re.sub(r'&#8216;', "'", body)
    body = re.sub(r'&#8220;', '"', body)
    body = re.sub(r'&#8221;', '"', body)
    body = re.sub(r'&#8230;', '...', body)
    body = re.sub(r'&amp;', '&', body)
    body = re.sub(r'&lt;', '<', body)
    body = re.sub(r'&gt;', '>', body)
    body = re.sub(r'&quot;', '"', body)

    # Remove email headers (From:, Sent:, To:, Subject:)
    body = re.sub(r'From:.*$', '', body, flags=re.MULTILINE)
    body = re.sub(r'Sent:.*$', '', body, flags=re.MULTILINE)
    body = re.sub(r'To:.*$', '', body, flags=re.MULTILINE)
    body = re.sub(r'Subject:.*$', '', body, flags=re.MULTILINE)
    body = re.sub(r'Date:.*$', '', body, flags=re.MULTILINE)
    body = re.sub(r'Cc:.*$', '', body, flags=re.MULTILINE)
    body = re.sub(r'Bcc:.*$', '', body, flags=re.MULTILINE)

    # Remove forwarded email chains
    body = re.sub(r'-{3,}Original Message-{3,}.*', '', body, flags=re.DOTALL)
    body = re.sub(r'-{3,}Forwarded message-{3,}.*', '', body, flags=re.DOTALL)
    body = re.sub(r'From:.*On.*wrote:.*$', '', body, flags=re.MULTILINE | re.DOTALL)

    # Remove email signatures
    signature_patterns = [
        r'--\s*Best regards,.*',
        r'--\s*Kind regards,.*',
        r'--\s*Cheers,.*',
        r'--\s*Thanks,.*',
        r'--\s*Thank you,.*',
        r'--\s*Warmly,.*',
        r'Sent from my.*',
        r'Get Outlook.*',
        r'_____+',
        r'\*\*\*Disclaimer.*',
        r'CONFIDENTIALITY NOTICE.*',
    ]

    for pattern in signature_patterns:
        body = re.sub(pattern, '', body, flags=re.DOTALL | re.IGNORECASE)

    # Remove common email footers
    body = re.sub(r'You are receiving this.*', '', body, flags=re.IGNORECASE)
    body = re.sub(r'Unsubscribe.*', '', body, flags=re.IGNORECASE)

    # Remove internal-only content
    body = re.sub(r'INTERNAL NOTE:.*', '', body, flags=re.IGNORECASE)
    body = re.sub(r'PRIVATE:.*', '', body, flags=re.IGNORECASE)
    body = re.sub(r'CONFIDENTIAL:.*', '', body, flags=re.IGNORECASE)

    # Clean up whitespace
    body = re.sub(r'\s+', ' ', body)
    body = body.strip()

    # Remove lingering special characters
    body = re.sub(r'^[\W\d]+', '', body, flags=re.MULTILINE)

    return body


def is_production_ready(body: str) -> tuple[bool, str]:
    """
    Check if cleaned body is production-ready.

    Returns: (is_ready, reason)
    """
    if not body or len(body) < 50:
        return False, "Too short or empty"

    # Check for remaining artifacts
    artifacts = [
        (r'v:\\?\*', 'VML tags present'),
        (r'&nbsp;', 'HTML entities present'),
        (r'From:', 'Email headers present'),
        (r'-{3,}Original Message', 'Forwarded chains present'),
        (r'Sent from my', 'Email signature present'),
        (r'<[^>]+>', 'HTML tags present'),
    ]

    for pattern, reason in artifacts:
        if re.search(pattern, body, re.IGNORECASE):
            return False, reason

    # Check for specific names (not reusable)
    specific_patterns = [
        r'\b(Hi|Hello|Dear)\s+[A-Z][a-z]+,',  # "Hi Lucy,"
        r'\bRegard[ds],\s+[A-Z][a-z]+',  # "Regards, Heidi"
        r'[A-Z][a-z]+\s+x\s*$',  # "Heidi x"
    ]

    for pattern in specific_patterns:
        if re.search(pattern, body):
            return False, "Contains specific names (not reusable as template)"

    # Check for specific dates (not reusable)
    if re.search(r'\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}', body):
        return False, "Contains specific dates (not reusable)"

    # Check for phone numbers
    if re.search(r'\b\d{3,4}[-.\s]?\d{3}[-.\s]?\d{4}\b', body):
        return False, "Contains phone numbers (not reusable)"

    return True, "Ready"


def make_reusable_template(body: str) -> str:
    """
    Convert specific response into reusable template.

    Replaces:
    - Names → [Customer Name]
    - Order numbers → [Order Number]
    - Products → [Product Name]
    - Dates → [Date]
    - Locations → [Location]
    """

    # Replace customer names (common patterns)
    body = re.sub(r'(Hi|Hello|Dear|Hey)\s+[A-Z][a-z]+', r'\1 [Customer Name]', body)

    # Replace sign-offs with specific names
    body = re.sub(r'[Rr]egard[ds],\s*[A-Z][a-z]+', '[Your Name]', body)
    body = re.sub(r'[Ww]arm\s+[Rr]egard[ds],\s*[A-Z][a-z]+', '[Your Name]', body)
    body = re.sub(r'[A-Z][a-z]+\s+x\s*$', '[Your Name]', body)

    # Replace order numbers
    body = re.sub(r'#?\d{4,}', '[Order Number]', body)
    body = re.sub(r'order\s+\#?\d+', 'order [Order Number]', body, flags=re.IGNORECASE)

    # Replace product names (Sagitine products)
    product_patterns = [
        r'New\s+York\s+\d+-Box\s+Stand',
        r'Shanghai\s+\d+-Box\s+Stand',
        r'Milan\s+\d+-Box\s+Stand',
        r'London\s+\d+-Box\s+Stand',
        r'Sydney\s+\d+-Box\s+Stand',
        r'Tokyo\s+\d+-Box\s+Stand',
        r'\d+-Box\s+Stand',
        r'Insert\s+Set',
        r'Black\s+Milan\s+Box',
        r'Box(es)?',
    ]

    for pattern in product_patterns:
        body = re.sub(pattern, '[Product Name]', body, flags=re.IGNORECASE)

    # Replace dates
    body = re.sub(r'\b(February|March|April|May|June|July|August)\s+\d{1,2}(st|nd|rd|th)?', '[Date]', body)
    body = re.sub(r'\bmid\s+to\s+late\s+\w+', '[Timeframe]', body, flags=re.IGNORECASE)

    # Replace locations
    body = re.sub(r'\b(Australia|Sydney|Melbourne|Brisbane|Perth)\b', '[Location]', body, flags=re.IGNORECASE)

    # Replace contact details
    body = re.sub(r'\bM:\s+\d{3,4}\s+\d{3,4}\b', '[Phone Number]', body)
    body = re.sub(r'\b\d{3,4}\s+\d{3,4}\b', '[Phone Number]', body)
    body = re.sub(r'[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}', '[Email Address]', body, flags=re.IGNORECASE)

    return body


def enforce_sagitine_tone(body: str) -> str:
    """
    Rewrite response to match Sagitine voice.

    Sagitine tone:
    - Composed, structured, elevated
    - Not overly casual
    - Not overly apologetic
    - Direct but warm
    """

    if not body:
        return body

    # Remove overly casual phrases
    body = re.sub(r'\bpopp?ing\s+in\b', 'following up', body, flags=re.IGNORECASE)
    body = re.sub(r'\bjust\s+wanted\s+to\b', 'I am writing to', body, flags=re.IGNORECASE)
    body = re.sub(r'\bthought\s+I\'d\b', 'I', body, flags=re.IGNORECASE)
    body = re.sub(r'\bhey\b', 'Hello', body, flags=re.IGNORECASE)
    body = re.sub(r'\bno\s+worries\b', 'Not at all', body, flags=re.IGNORECASE)
    body = re.sub(r'\bno\s+problem\b', 'You are welcome', body, flags=re.IGNORECASE)
    body = re.sub(r'\bcheers\b', 'Kind regards', body, flags=re.IGNORECASE)

    # Remove overly apologetic language
    body = re.sub(r'\bI\s+apologise\b', 'Thank you for bringing this to my attention', body, flags=re.IGNORECASE)
    body = re.sub(r'\bI\s+apologize\b', 'Thank you for bringing this to my attention', body, flags=re.IGNORECASE)
    body = re.sub(r'\bsorry\s+for\s+(any|the)\s+inconvenience', 'Thank you for your patience', body, flags=re.IGNORECASE)
    body = re.sub(r"\bI'm\s+sorry\s+to\s+hear\b", 'Thank you for letting me know', body, flags=re.IGNORECASE)
    body = re.sub(r'\bWe\s+apologize\s+for\b', 'Thank you for bringing this to our attention', body, flags=re.IGNORECASE)
    body = re.sub(r'\bSo\s+sorry\s+about\b', 'I appreciate you sharing', body, flags=re.IGNORECASE)
    body = re.sub(r'\bregret\s+to\s+inform', 'Unfortunately', body, flags=re.IGNORECASE)
    body = re.sub(r'\bunfortunately\b', 'Please note', body, flags=re.IGNORECASE)

    # Enforce proper terminology
    body = re.sub(r'\bdrawer\b', 'Box', body, flags=re.IGNORECASE)
    body = re.sub(r'\bunit\b', 'Box', body, flags=re.IGNORECASE)
    body = re.sub(r'\bproduct\b', 'Box', body, flags=re.IGNORECASE)  # When context suggests Sagitine product

    # Ensure proper greeting
    if not re.search(r'^(Hi|Hello|Dear)', body, re.IGNORECASE):
        body = 'Hello [Customer Name],\n\n' + body

    # Ensure proper closing (single closing only)
    has_closing = re.search(r'(Warm regards|Kind regards|Best regards|Sincerely|With gratitude),?\s*\[?Your Name\]?\s*$', body, re.MULTILINE | re.IGNORECASE)
    has_placeholder = re.search(r'\[Your Name\]', body)

    if has_closing and has_placeholder:
        # Template already has closing - remove any duplicates
        # Keep only the last occurrence
        lines = body.split('\n')
        seen_closing = False
        cleaned_lines = []
        for i, line in enumerate(lines):
            if re.match(r'^(Warm regards|Kind regards|Best regards|Sincerely|With gratitude)', line, re.IGNORECASE):
                if not seen_closing:
                    cleaned_lines.append(line)
                    # Keep the next line if it's "[Your Name]" or similar
                    if i + 1 < len(lines) and re.match(r'^\[?Your Name\]?\s*$', lines[i + 1]):
                        cleaned_lines.append(lines[i + 1])
                    seen_closing = True
            else:
                cleaned_lines.append(line)
        body = '\n'.join(cleaned_lines)
    elif not has_closing:
        # No closing - add one
        # Remove existing weak closings first
        body = re.sub(r'[A-Z][a-z]+\s+x\s*$', '', body, flags=re.MULTILINE)
        body = body.rstrip() + '\n\nWarm regards,\n[Your Name]'

    # Ensure proper structure
    sentences = body.split('. ')
    if len(sentences) > 1:
        body = '.\n\n'.join(sentences)

    return body
