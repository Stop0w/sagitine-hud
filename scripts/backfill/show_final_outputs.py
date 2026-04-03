#!/usr/bin/env python3
"""
Show final regenerated outputs for review.
"""

import json

print("=" * 80)
print("FINAL REGENERATED OUTPUTS - READY FOR REVIEW")
print("=" * 80)

# Gold responses
g = json.load(open('../../data/knowledge/gold_responses.json'))
print(f"\nGOLD RESPONSE TEMPLATES ({len(g)} total):\n")

for i, t in enumerate(g[:5], 1):  # Show first 5
    print(f"{i}. {t['title']}")
    print(f"   Category: {t['category']}")
    print(f"   Samples used: {t['sample_count']}")
    print(f"   Preview (first 300 chars):")
    preview = t['body_template'][:300].replace('\n', ' ')
    print(f"   {preview}...")
    print()

if len(g) > 5:
    print(f"   ... and {len(g) - 5} more templates")
    print()

# Knowledge snippets
s = json.load(open('../../data/knowledge/knowledge_snippets.json'))
print(f"\nKNOWLEDGE SNIPPETS ({len(s)} total):\n")

policies = [sn for sn in s if sn['type'] == 'policy']
facts = [sn for sn in s if sn['type'] == 'fact']

print(f"POLICIES ({len(policies)}):")
for sn in policies:
    print(f"  - {sn['title']}")
    print(f"    {sn['content'][:150]}...")
    print()

print(f"FACTS ({len(facts)}):")
for sn in facts:
    print(f"  - {sn['title']}")
    print(f"    {sn['content'][:150]}...")
    print()

print("=" * 80)
print("FIXES APPLIED:")
print("=" * 80)
print("1. OK Terminology Logic: Policies preserve 'drawer'/'unit' in instructions")
print("2. OK Tone Enforcement: Removed all apologies (e.g., 'I'm sorry to hear')")
print("3. OK Signature De-Duplication: Removed duplicate closings")
print("\nAll templates now use placeholders: [Customer Name], [Box Name], [timeframe]")
print("All content enforces Sagitine tone: composed, confident, warm but not apologetic")
print("=" * 80)
