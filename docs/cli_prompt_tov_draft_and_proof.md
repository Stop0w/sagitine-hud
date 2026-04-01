You are working on the Sagitine AI CX Agent backend.

I want to add a final Sagitine Tone of Voice enforcement layer in two places:
1. draft generation
2. proofing

Goal
Ensure responses are always:
- on brand
- policy-safe
- grammatically clean
- terminology-correct
- consistent with Sagitine’s luxury customer service voice

This is not a rewrite of the existing architecture.
It is an enforcement layer on top of the strategy-first system that already exists.

What I want implemented

1) Add TOV enforcement to draft generation
Update the draft-generation flow so the final customer draft is generated with explicit Sagitine TOV rules included in the prompt and/or deterministic post-processing.

The draft generation layer should enforce:
- calm, warm, polished, quietly premium tone
- clear next-step ownership language
- concise structure
- no over-apologising
- no casual language
- no promises outside policy
- consistent sign-off

Required preferred language
- “Thank you for reaching out”
- “Thank you for letting me know”
- “I can arrange…”
- “I can organise…”
- “Just let me know what works best”
- “Warm regards, Heidi x”

Required terminology
- Prefer “Box” / “Boxes”
- Never use “drawer” / “drawers”
- Avoid generic “unit” where “Box” is correct

Must avoid
- “I’m sorry”
- “We apologise”
- “Unfortunately”
- “That shouldn’t have happened”
- “No worries”
- “Awesome”
- “Super”
- “Hey”
- over-explaining
- salesy language
- policy promises not supported by rules/templates

2) Add TOV enforcement to proofing
Update the proof endpoint so proofing checks not only grammar, spelling, duplication, clarity, and risk, but also Sagitine brand tone compliance.

Proofing should detect and fix:
- off-brand phrasing
- over-apologetic phrasing
- casual phrasing
- prohibited terminology
- “drawer” instead of “Box”
- luxury-tone drift
- weak / clunky sign-off language

3) Extend proof output to include brand compliance
Without breaking the current frontend contract, add a brand-aware dimension to the proof result.

Preferred:
- keep existing response shape stable
- use suggestions and summary for now if easiest
- if safe to extend, add:
  `brandCompliance: "pass" | "fixes_applied" | "warning"`

If adding a field would create frontend mismatch, keep it internal for now but still apply the fixes in correctedDraft and suggestions.

4) Keep deterministic cleanup where useful
Do not rely only on Haiku.
Use deterministic cleanup for obvious rules such as:
- replace drawer/drawers with Box/Boxes
- remove apology phrases where appropriate
- enforce sign-off consistency if missing or malformed

5) Do not over-tighten the tone
Important:
Sagitine should feel warm and premium, not robotic or sterile.
Do not flatten all responses into the same rigid script.
Protect naturalness while enforcing brand boundaries.

6) Deliverables
Please implement this and return:
1. exact files changed
2. exact prompt additions made for draft generation
3. exact prompt/rubric additions made for proofing
4. any deterministic cleanup rules added
5. whether frontend changes are required or not
6. one before/after example showing TOV correction in both:
   - draft generation
   - proofing

Reference TOV rules

Core tone:
- calm
- warm
- polished
- helpful
- quietly premium
- clear
- never gushy
- never corporate

Preferred phrasing:
- “Thank you for reaching out”
- “Thank you for letting me know”
- “I can arrange…”
- “I can organise…”
- “Just let me know what works best”
- “Warm regards, Heidi x”

Terminology:
- always use Box / Boxes
- never use drawer / drawers
- avoid generic “item”, “unit”, “product” where Box is better

Avoid:
- “I’m sorry”
- “We apologise”
- “Unfortunately”
- “That shouldn’t have happened”
- “No worries”
- “Awesome”
- “Super”
- “Hey”
- overly casual or salesy language
- over-explaining
- promises outside policy

Structure:
- short paragraphs
- direct next step
- ownership language
- concise explanation
- elegant sign-off
