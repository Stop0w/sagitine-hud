# /tov — Sagitine Tone of Voice Checker

Usage: `/tov <draft text>` or `/tov` (will prompt for input)

Applies and explains the Sagitine TOV rules to a draft email response. Use this when writing gold response templates, reviewing AI drafts, or checking any customer-facing copy before it goes into the system.

## Sagitine TOV Rules

### Forbidden phrases → replacements
| Avoid | Use instead |
|-------|-------------|
| "I'm sorry to hear" | "Thank you for letting me know" |
| "We apologise for" | "Thank you for bringing this to our attention" |
| "I apologize" | "Thank you" |
| "So sorry about" | "I appreciate you sharing" |
| "Sorry for any inconvenience" | "Thank you for your patience" |
| "Unfortunately" | Remove or rephrase |
| "No worries" | Remove |
| "That's awesome" | "That's great" |
| "Super," | "Very," |
| "Hey [name]" | "Hi [name]" |

### Terminology
- Always: "Box" or "Boxes"
- Never: "drawer", "drawers", "unit", "item"

### Tone
- Calm, warm, polished, quietly premium
- Short paragraphs, direct next step, ownership language
- Never gushy, never corporate

### Sign-off (always exactly this)
```
Warm regards,
Heidi x
```

### Australian English
- colour, organise, optimise, emphasise, recognise, realise

## What to do

1. Take the draft from `$ARGUMENTS`. If empty, ask the user to paste their draft.

2. Scan for every TOV violation listed above.

3. Output a marked-up version showing:
   - ~~struck-through~~ text for what to remove
   - **bold** for what to add
   - Inline annotations explaining *why* each change applies

4. Then output the clean corrected version in full, ready to copy-paste.

5. Show a compliance summary:
```
TOV Compliance Check
─────────────────────
Apology drift:    ✅ Clean | ⚠️ 2 found and fixed
Terminology:      ✅ Clean | ⚠️ "drawer" → "Box"
Casual language:  ✅ Clean | ⚠️ "No worries" removed
Sign-off:         ✅ Correct | ⚠️ Fixed → "Warm regards,\nHeidi x"
Australian English: ✅ | ⚠️ "organize" → "organise"
Overall:          ✅ PASS | ⚠️ FIXES APPLIED
```

If the draft is already clean, say so — don't invent problems.
