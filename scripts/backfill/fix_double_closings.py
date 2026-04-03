#!/usr/bin/env python3
"""
Fix double closings in JSON files.
"""

import json
import re
from pathlib import Path

def fix_double_closings(text: str) -> str:
    """Remove duplicate closings, keeping only the last one."""
    if not text:
        return text

    lines = text.split('\n')

    # Find all closing lines
    closing_patterns = [
        r'^Warm regards,?\s*\[?Your Name\]?\s*$',
        r'^Kind regards,?\s*\[?Your Name\]?\s*$',
        r'^Best regards,?\s*\[?Your Name\]?\s*$',
        r'^Sincerely,?\s*\[?Your Name\]?\s*$',
        r'^With gratitude,?\s*\[?Your Name\]?\s*$',
    ]

    # Work backwards to find the last closing
    last_closing_idx = -1
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        for pattern in closing_patterns:
            if re.match(pattern, line, re.IGNORECASE):
                last_closing_idx = i
                break
        if last_closing_idx >= 0:
            break

    if last_closing_idx < 0:
        # No closing found
        return text

    # Build result: keep everything up to and including the last closing
    result_lines = []
    skip_next = False
    seen_closing = False

    for i, line in enumerate(lines):
        if skip_next:
            skip_next = False
            continue

        line_stripped = line.strip()

        # Check if this is a closing line
        is_closing = False
        for pattern in closing_patterns:
            if re.match(pattern, line_stripped, re.IGNORECASE):
                is_closing = True
                break

        if is_closing:
            if not seen_closing:
                # First closing - keep it
                result_lines.append(line)
                # Check if next line is [Your Name]
                if i + 1 < len(lines) and re.match(r'^\[?Your Name\]?\s*$', lines[i + 1].strip()):
                    result_lines.append(lines[i + 1])
                    skip_next = True
                seen_closing = True
            # else: duplicate closing - skip it
        else:
            result_lines.append(line)

    return '\n'.join(result_lines)

def fix_json_file(file_path: Path):
    """Fix double closings in JSON file."""
    print(f"Processing: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if isinstance(data, list):
        for item in data:
            if 'body_template' in item:
                original = item['body_template']
                fixed = fix_double_closings(original)
                if fixed != original:
                    print(f"  Fixed: {item.get('title', 'unknown')}")
                    item['body_template'] = fixed

    # Save with pretty formatting
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"  Saved: {file_path}")

if __name__ == '__main__':
    knowledge_dir = Path(__file__).parent.parent.parent / 'data' / 'knowledge'

    gold_file = knowledge_dir / 'gold_responses.json'

    if gold_file.exists():
        fix_json_file(gold_file)
    else:
        print(f"File not found: {gold_file}")
