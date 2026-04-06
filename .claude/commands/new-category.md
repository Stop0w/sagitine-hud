# /new-category — Scaffold a New Email Category

Usage: `/new-category <category_enum_name>`

Adds a new email category to every file that needs it. Categories drift when added ad-hoc — this ensures all four required locations are updated atomically.

`$ARGUMENTS` is the new category enum name in snake_case (e.g. `loyalty_rewards_enquiry`).

## Files that must be updated

### 1. `api/classify.ts` — two places

**a) The `classifyEmail` keyword router** — add a new `case` block:
```typescript
case 'your_new_category': {
  return {
    ...base,
    category_primary: 'your_new_category',
    urgency: 5,           // set appropriate default
    risk_level: 'low',
    reply_subject: `Re: ${subject}`,
    reply_body: `<p>Hi ${customerName},</p><p>Thank you for reaching out.</p><p>[Draft response for this category]</p><p>Warm regards,<br>Heidi x</p>`,
  };
}
```

**b) The keyword → category mapping** — add keywords that will trigger this category.

### 2. `api/hub.ts` — `CATEGORY_LABELS` map
```typescript
your_new_category: 'Human Readable Label',
```

### 3. `src/lib/data-transformer.ts` — `CATEGORY_CONFIG` map
```typescript
your_new_category: { label: 'Human Readable Label', shortLabel: 'Short' },
```

### 4. `CLAUDE.md` — canonical category enums list
Add the new enum to the list under "Canonical Category Enums".

## Steps

1. Read `$ARGUMENTS`. If no argument given, ask for: the enum name, a human-readable label, a short label (for the HUD sidebar), and 3–5 keywords that should trigger it.

2. Make all four file edits above.

3. Show a diff summary of every change made.

4. Remind the user:
   > "Add a gold response template to the `gold_responses` table in Neon for this category — Claude Haiku uses it as a RAG reference when drafting personalised replies. Without it, Haiku will draft without a template."
   >
   > SQL to run in Neon console:
   > ```sql
   > INSERT INTO gold_responses (category, body_template, tone_notes, is_active, use_count)
   > VALUES ('your_new_category', 'Your template here...', 'Tone notes here', true, 0);
   > ```

5. Ask if they want to deploy immediately with `/deploy`.
