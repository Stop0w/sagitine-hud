# Sagitine TOV Enforcement Layer

## Recommendation

Yes — add the Sagitine Tone of Voice layer in **both places**:

1. **Draft generation**
2. **Proofing**

This creates a two-layer protection system:

- **Draft layer**: steers the first version toward brand-safe language
- **Proof layer**: catches drift, edge cases, and non-brand edits before send

That is the safest MVP architecture because it does not rely on one model pass to get everything right.

---

## Why this should exist in both places

### 1) During draft generation
The model should generate from:
- strategy object
- selected template
- customer context
- Sagitine TOV rules

This improves first-pass quality and reduces proof churn.

### 2) During proofing
The proof service should also check:
- grammar
- spelling
- duplication
- clarity
- policy risk
- **brand TOV compliance**

This protects against:
- operator edits that drift off-brand
- templates that contain legacy phrasing
- inconsistent wording from model variation

---

## TOV rules to enforce

### Core tone
- Calm
- Warm
- Polished
- Helpful
- Quietly premium
- Clear
- Never gushy
- Never corporate

### Preferred phrasing
- “Thank you for reaching out”
- “Thank you for letting me know”
- “I can arrange…”
- “I can organise…”
- “Just let me know what works best”
- “Warm regards, Heidi x”

### Terminology
- Always use **Box / Boxes**
- Never use **drawer / drawers**
- Avoid generic “item”, “unit”, “product” where “Box” is more appropriate

### Avoid
- “I’m sorry”
- “We apologise”
- “Unfortunately”
- “That shouldn’t have happened”
- “No worries”
- “Awesome”
- “Super”
- “Hey”
- Overly casual or salesy language
- Over-explaining
- Promises outside policy

### Structural preferences
- Short paragraphs
- Direct next step
- Ownership language
- Concise explanation
- Elegant sign-off

---

## Suggested architecture

### Draft generation
Add a final TOV instruction block to the draft-generation prompt and keep deterministic cleanup after generation.

### Proofing
Expand the proof rubric to include:
- brand tone fit
- terminology compliance
- luxury CX tone
- prohibited wording
- structural neatness

### Output expectation from proof
Return:
- corrected draft
- suggestions
- summary
- optional `brandCompliance` field

Example:
- `brandCompliance: "pass" | "fixes_applied" | "warning"`

---

## Success criteria

A response should only be considered send-ready when it is:
- strategy-aligned
- grammatically correct
- policy-safe
- **on brand**

That makes TOV the final guardrail, not a nice-to-have.
