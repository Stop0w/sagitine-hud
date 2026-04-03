#!/usr/bin/env python3
"""
Simple fix for duplicate [Your Name] lines.
"""

import json
from pathlib import Path

def fix_duplicate_your_name(text: str) -> str:
    """Remove duplicate [Your Name] lines at the end."""
    if not text:
        return text

    lines = text.split('\n')

    # Find all [Your Name] lines
    your_name_indices = [i for i, line in enumerate(lines) if line.strip() == '[Your Name]']

    if len(your_name_indices) <= 1:
        return text  # No duplicates

    # Keep only the last [Your Name]
    last_index = your_name_indices[-1]

    # Remove all but the last [Your Name]
    filtered_lines = []
    removed_count = 0
    for i, line in enumerate(lines):
        if line.strip() == '[Your Name]' and i != last_index:
            removed_count += 1
            continue
        filtered_lines.append(line)

    if removed_count > 0:
        print(f"    Removed {removed_count} duplicate '[Your Name]' lines")

    return '\n'.join(filtered_lines)

def main():
    """Fix duplicate closings in gold_responses.json."""
    knowledge_dir = Path(__file__).parent.parent.parent / 'data' / 'knowledge'
    gold_file = knowledge_dir / 'gold_responses.json'

    print(f"Processing: {gold_file}")

    with open(gold_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for item in data:
        if 'body_template' in item:
            print(f"  Checking: {item.get('title', 'unknown')}")
            original = item['body_template']
            fixed = fix_duplicate_your_name(original)
            item['body_template'] = fixed

    # Save
    with open(gold_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nSaved: {gold_file}")

if __name__ == '__main__':
    main()
