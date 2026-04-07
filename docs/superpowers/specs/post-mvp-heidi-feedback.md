# Sagitine HUD — Post-MVP Operator Feedback Plan

**Author:** Claude Code  
**Date:** 2026-04-07  
**Status:** DRAFT — awaiting review before execution  
**Source:** Heidi operator feedback session + Hayden analysis

---

## How to use this document

Each task is self-contained. Any agent can pick up any task and execute it without needing context from prior conversations. Every task includes:

- **What** needs to change
- **Why** it matters
- **Where** the code lives (exact file paths and line numbers)
- **How** to implement (specific changes, not vague instructions)
- **Acceptance criteria** (how to verify it worked)
- **Dependencies** on other tasks (if any)

---

## Phase 1 — Fix What's Broken (P0)

### C1: Proofing Not Catching Duplicate Sign-Off

**Problem:** Heidi intentionally added a second "Warm regards, Heidi x" to test the proof function. The proofer did not flag or remove it.

**Root cause (confirmed):** `applySagitineTOVCleanup()` in `api/hub.ts` lines 13-38 only ADDS a sign-off if none exists. It never REMOVES duplicates. The logic at line 32:

```typescript
if (!cleaned.match(/Warm regards,\s*Heidi x/i)) {
  // only enters this block if ZERO sign-offs exist
  cleaned = cleaned.trimEnd() + '\n\nWarm regards,\nHeidi x';
}
```

If TWO sign-offs exist, the regex matches (returns truthy), so the block is skipped entirely — both duplicates survive.

Additionally, the Claude Haiku proof prompt (lines 684-713) does not explicitly instruct the model to check for or remove duplicate sign-offs.

**Files to modify:**
- `api/hub.ts` — `applySagitineTOVCleanup()` function (lines 13-38)
- `api/hub.ts` — `proofTicketDraft()` prompt (lines 684-713)

**Implementation:**

1. **Fix `applySagitineTOVCleanup()` (lines 13-38):** Before the existing sign-off check, add a deduplication step:
   ```typescript
   // Strip ALL existing sign-off variants (greedy), then re-append exactly once
   cleaned = cleaned.replace(/\n*\s*(Warm regards|Kind regards|Best regards|Regards|Best)[,\s]*\n?\s*(Heidi\s*x?)?\s*/gi, '');
   cleaned = cleaned.trimEnd() + '\n\nWarm regards,\nHeidi x';
   ```
   This replaces the current conditional logic (lines 32-36). The sign-off is now always stripped and always re-appended exactly once, unconditionally.

2. **Strengthen the proof prompt (line 693 area):** Add to the proofing instructions:
   ```
   - Check for duplicate sign-offs (e.g. "Warm regards, Heidi x" appearing more than once). If found, flag as type "duplication", severity "high".
   ```

**Acceptance criteria:**
- Send a draft containing "Warm regards,\nHeidi x" twice through `applySagitineTOVCleanup()` — output must contain exactly one sign-off
- Send it through the full proof pipeline — Claude must flag the duplication in suggestions
- Existing drafts with a single correct sign-off must be unchanged
- Drafts with no sign-off must have one appended

**Dependencies:** None

---

### D1: Original Inbound Email Not Leaving Inbox

**Problem:** When Make.com Route 2 fires (auto-draft categories), it creates a draft in Drafts, then moves the DRAFT to `02_AI Drafted`. But the **original inbound email** (`{{1.id}}`) is never moved — it stays in the Inbox. This means Heidi sees the same email in both the Inbox and the HUD, creating confusion and fear of missing something.

**Evidence from blueprint:** Route 2 has two modules:
- Module 5 (`createAMessage`): creates draft → output is `{{5.id}}`
- Module 8 (`moveAMessage`): moves `{{5.id}}` (the draft) to review folder

Module 8 moves the draft, not the original. Compare with Route 1 (spam) and Route 3 (manual), which both correctly move `{{1.id}}` (the original).

**Fix (in Make.com, not code):** Add a third module to Route 2's flow after Module 8:

| Setting | Value |
|---------|-------|
| Module type | `microsoft-email:moveAMessage` |
| Message ID | `{{1.id}}` (the original inbound email) |
| Destination folder | `01_AI Processing` |
| Connection | Same Azure connection (8146287) |

**Result after fix:**
- Original email: Inbox → `01_AI Processing`
- AI draft: Drafts → `02_AI Drafted`
- Inbox becomes empty after processing

**Acceptance criteria:**
- Send a test email to info@sagitine.com
- After Make.com runs: original is in `01_AI Processing`, draft is in `02_AI Drafted`, Inbox is empty
- Routes 1 (spam) and 3 (manual) continue to work as before

**Dependencies:** None. This is a Make.com configuration change, no code.

---

### E2: Time Format — Raw Minutes to Human-Readable

**Problem:** Wait times display as raw minutes (e.g. "2243m"), which is unreadable for large values.

**Current rendering locations:**

| Location | File | Line | Current format |
|----------|------|------|----------------|
| Ticket queue row | `src/features/notification-hub/components/TicketQueue.tsx` | 294 | `{ticket.waitingMinutes}m` |
| Resolution console sidebar | `src/features/notification-hub/components/ResolutionConsoleMVP.tsx` | 377 | `{ticket.waitingMinutes} min` |

**Calculation source:** `src/lib/data-transformer.ts` lines 71-74:
```typescript
function waitingMinutes(receivedAt: string): number {
  const diff = Date.now() - new Date(receivedAt).getTime();
  return Math.max(0, Math.floor(diff / 60_000));
}
```

**Implementation:**

1. Add a formatting utility to `src/lib/data-transformer.ts` (after line 74):
   ```typescript
   export function formatWaitTime(minutes: number): string {
     if (minutes < 60) return `${minutes}m`;
     if (minutes < 1440) {
       const h = Math.floor(minutes / 60);
       const m = minutes % 60;
       return m > 0 ? `${h}h ${m}m` : `${h}h`;
     }
     const d = Math.floor(minutes / 1440);
     const h = Math.floor((minutes % 1440) / 60);
     return h > 0 ? `${d}d ${h}h` : `${d}d`;
   }
   ```

2. **TicketQueue.tsx line 294:** Change `{ticket.waitingMinutes}m` to `{formatWaitTime(ticket.waitingMinutes)}`
   - Import: `import { formatWaitTime } from '../../../lib/data-transformer';`

3. **ResolutionConsoleMVP.tsx line 377:** Change `{ticket.waitingMinutes} min` to `{formatWaitTime(ticket.waitingMinutes)}`
   - Import: `import { formatWaitTime } from '../../../lib/data-transformer';`

**Examples:**
- 25 → `25m`
- 90 → `1h 30m`
- 2243 → `1d 13h`
- 4320 → `3d`

**Acceptance criteria:**
- TicketQueue shows human-readable time (e.g. "1d 13h" not "2243m")
- ResolutionConsoleMVP shows same format
- Values under 60 minutes still show as `Xm`
- Build passes with no TypeScript errors

**Dependencies:** None

---

### A1: HUD-Sent Emails Must Match Outlook Format

**Problem:** Emails sent from the HUD look different from emails sent directly via Outlook. The current dispatch HTML is minimal — no `From:` / `Sent:` / `To:` / `Subject:` header block above the quoted original, no proper HTML wrapper. This makes HUD-sent emails look "fake" to recipients who compare with normal Outlook replies.

**Current dispatch code:** `api/hub.ts` lines 1046-1049:
```typescript
let htmlToSend = final_message_sent;
if (ctx.original_body_html) {
  htmlToSend += `<br><br><hr><blockquote style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">${ctx.original_body_html}</blockquote>`;
}
```

**What Outlook actually sends (from screenshot):** Before the quoted original, Outlook inserts a metadata header:
```html
<hr>
<b>From:</b> heidi Melville &lt;heidimelville@hotmail.com&gt;<br>
<b>Sent:</b> 07 April 2026 12:11<br>
<b>To:</b> info &lt;info@sagitine.com&gt;<br>
<b>Subject:</b> Help pleaseHia<br>
<br>
```

**Current Graph API sendMail payload:** `api/hub.ts` lines 971-978:
```typescript
{
  "message": {
    "subject": subject,
    "body": { "contentType": "HTML", "content": htmlBody },
    "toRecipients": [{ "emailAddress": { "address": toEmail, "name": toName || toEmail } }]
  },
  "saveToSentItems": true
}
```

**Missing threading headers:** No `In-Reply-To`, `References`, or `conversationId` — the reply won't thread in the recipient's inbox.

**Files to modify:**
- `api/hub.ts` — `dispatchTicket()` function (around line 1046) and `sendViaGraph()` function (around line 964)

**Implementation:**

1. **Add Outlook-style reply header block (around line 1048):**
   ```typescript
   let htmlToSend = final_message_sent;
   if (ctx.original_body_html) {
     const sentDate = new Date(ctx.received_at).toLocaleString('en-AU', {
       day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
     });
     const replyHeader = `
       <hr style="display:inline-block;width:98%">
       <div style="padding:4px 0">
         <b>From:</b> ${ctx.from_name} &lt;${ctx.from_email}&gt;<br>
         <b>Sent:</b> ${sentDate}<br>
         <b>To:</b> info &lt;info@sagitine.com&gt;<br>
         <b>Subject:</b> ${ctx.subject}<br>
       </div>
     `;
     htmlToSend += `<br><br>${replyHeader}<blockquote style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">${ctx.original_body_html}</blockquote>`;
   }
   ```

2. **Add threading headers to Graph API payload.** First, ensure `internet_message_id` is stored in `inbound_emails` (check if it exists — it's passed as `message_id` from Make.com). Then update the `sendViaGraph()` payload:
   ```typescript
   {
     "message": {
       "subject": subject,
       "body": { "contentType": "HTML", "content": htmlBody },
       "toRecipients": [{ "emailAddress": { "address": toEmail, "name": toName || toEmail } }],
       "internetMessageHeaders": [
         { "name": "In-Reply-To", "value": ctx.internet_message_id },
         { "name": "References", "value": ctx.internet_message_id }
       ]
     },
     "saveToSentItems": true
   }
   ```
   Note: The `internet_message_id` field needs to be fetched from `inbound_emails` in the dispatch query (line ~1015). The `message_id` column in `inbound_emails` stores the Outlook Graph ID, not the RFC 822 Internet-Message-Id. Check if `internet_message_id` is stored separately or if we need to fetch it from the original email headers.

3. **Wrap in Outlook-compatible HTML envelope:** Wrap the entire `htmlToSend` in a minimal HTML document:
   ```typescript
   htmlToSend = `<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>${htmlToSend}</body></html>`;
   ```

**Acceptance criteria:**
- Send a test email from HUD, open in recipient's Outlook
- Reply must show "From: / Sent: / To: / Subject:" header block above quoted original
- Reply must thread correctly in recipient's inbox (same conversation)
- Sent email must appear in info@sagitine.com Sent Items
- Format must visually match a reply sent directly from Outlook

**Dependencies:** None, but verify `internet_message_id` availability in inbound_emails before implementing threading headers. If not available, implement the visual format first, threading as a follow-up.

---

### A2: Sender Must Always Be info@sagitine.com

**Current state (confirmed working):** `api/hub.ts` line 1035:
```typescript
const senderEmail = process.env.MICROSOFT_SENDER_EMAIL!;
```

Line 964: Graph API URL uses `/users/${senderEmail}/sendMail`

**Verification needed:** The sender is technically correct at the API level, but we need to confirm that:
1. The `MICROSOFT_SENDER_EMAIL` env var in Vercel is set to `info@sagitine.com` (not a variant)
2. Recipients see "info@sagitine.com" in their From field (not the Azure app registration email or tenant admin)

**Implementation:** This is a verification task, not a code change.

1. Check Vercel env: `vercel env ls` — confirm `MICROSOFT_SENDER_EMAIL` is present
2. Send a test email from HUD to an external address
3. View raw headers of received email — confirm `From:` shows `info@sagitine.com`
4. If mismatch: check Azure AD app registration → API permissions → ensure `Mail.Send` is granted for the correct mailbox

**Acceptance criteria:**
- External recipient sees "info@sagitine.com" as the sender
- No "on behalf of" or proxy sender shown

**Dependencies:** None

---

## Phase 2 — Core Workflow Upgrade (P0-P1)

### B1: "Immediate Feedback" Button — Operator-Guided Draft Regeneration

**Problem:** When the AI categorises wrong or the draft tone is off, Heidi currently copies the email to ChatGPT, gets a rewrite, then pastes it back. This workflow should happen entirely within the HUD.

**Current UI state:** `ResolutionConsoleMVP.tsx` has two action buttons:
- **Edit Response** (line 696-704): toggles a text editor for the draft
- **PROOF & REVIEW** / **SEND RESPONSE** (lines 705-733): proof then send

**Proposed UX:** Add a third button **"FEEDBACK"** between Edit and Proof. Clicking it:
1. Opens a text input area (2-4 lines) below the draft editor
2. Operator types natural language feedback, e.g.:
   - "This is a return request, not a product question — rewrite for returns"
   - "Tone is too formal, make it warmer"
   - "They asked about the Milan Box specifically, not the Florence"
   - "Wrong category — this should be order_modification_cancellation"
3. Operator clicks "Regenerate" button
4. API call sends feedback + original email + current draft to Claude Haiku
5. Claude returns a new draft, which replaces the current draft in the editor
6. Operator can then edit, proof, and send as normal

**Files to create/modify:**

#### B1a: New API endpoint — `api/hub.ts`

Add a new route handler inside the existing hub.ts router (after the proof handler, around line 830).

**Route:** `POST /api/hub/ticket/:id/regenerate`

**Request body:**
```json
{
  "feedbackText": "This is a return request not a product question",
  "currentDraft": "Hello Heidi, Thank you for reaching out about...",
  "currentCategory": "product_usage_guidance"
}
```

**Implementation:**
```typescript
async function regenerateTicketDraft(req: any, res: any) {
  const ticketId = req.url.split('/')[4]; // /api/hub/ticket/:id/regenerate
  const { feedbackText, currentDraft, currentCategory } = req.body || {};

  if (!feedbackText) {
    return res.status(400).json({ success: false, error: 'feedbackText is required' });
  }

  const sql = neon(process.env.DATABASE_URL!);

  // Fetch original email context
  const ticketRows = await sql`
    SELECT ie.from_name, ie.from_email, ie.subject, ie.body_plain, ie.body_html,
           tr.category_primary, tr.customer_intent_summary, tr.reply_body,
           cp.name as customer_name, cp.total_contact_count, cp.shopify_order_count
    FROM tickets t
    JOIN inbound_emails ie ON t.email_id = ie.id
    JOIN triage_results tr ON t.triage_result_id = tr.id
    LEFT JOIN customer_profiles cp ON ie.from_email = cp.email
    WHERE t.id = ${ticketId}
    LIMIT 1
  `;

  if (ticketRows.length === 0) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }

  const ctx = ticketRows[0];

  // Fetch gold responses for the category (if operator corrected the category, use that)
  const effectiveCategory = currentCategory || ctx.category_primary;
  const goldResponses = await sql`
    SELECT response_text FROM gold_responses
    WHERE category = ${effectiveCategory}
    ORDER BY created_at DESC LIMIT 3
  `;

  const goldContext = goldResponses.length > 0
    ? `\n\nAPPROVED RESPONSE EXAMPLES FOR THIS CATEGORY:\n${goldResponses.map((g: any) => g.response_text).join('\n---\n')}`
    : '';

  const prompt = `You are a customer service writer for Sagitine, a premium Australian storage box brand.

ORIGINAL CUSTOMER EMAIL:
From: ${ctx.from_name} <${ctx.from_email}>
Subject: ${ctx.subject}
Body: ${ctx.body_plain?.substring(0, 1500)}

CURRENT AI DRAFT (needs revision):
${currentDraft || ctx.reply_body}

OPERATOR FEEDBACK — THIS IS THE MOST IMPORTANT INPUT. Follow these instructions precisely:
${feedbackText}
${goldContext}

TONE OF VOICE RULES:
- Never apologise — use "Thank you for letting me know" / "Thank you for reaching out"
- Never use "Unfortunately", "I'm sorry", "We apologise"
- Always use "Box" or "Boxes" — never "drawer", "unit", or "item"
- Sign-off is always exactly: Warm regards,\\nHeidi x
- Tone: calm, warm, polished, quietly premium — never gushy or corporate
- Australian English: colour, optimise, organise

Write a complete revised email response incorporating the operator's feedback. Return ONLY the email text, no JSON wrapper, no explanations.`;

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const anthropicData = await anthropicRes.json();
  let regeneratedDraft = anthropicData.content?.[0]?.text || '';

  // Apply TOV cleanup
  regeneratedDraft = applySagitineTOVCleanup(regeneratedDraft);

  // Store the feedback for future learning (B2 dependency)
  await sql`
    INSERT INTO operator_feedback (ticket_id, feedback_text, original_category, suggested_category, original_draft, regenerated_draft)
    VALUES (${ticketId}, ${feedbackText}, ${ctx.category_primary}, ${effectiveCategory}, ${currentDraft || ctx.reply_body}, ${regeneratedDraft})
  `;

  return res.status(200).json({
    success: true,
    data: { regeneratedDraft, appliedCategory: effectiveCategory },
    timestamp: new Date().toISOString()
  });
}
```

**Add route to the handler (around line 1170):**
```typescript
if (req.url.match(/^\/api\/hub\/ticket\/[^/]+\/regenerate$/) && req.method === 'POST') {
  return regenerateTicketDraft(req, res);
}
```

#### B1b: Database table — `operator_feedback`

Create migration or inline SQL to create:
```sql
CREATE TABLE IF NOT EXISTS operator_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  original_category TEXT,
  suggested_category TEXT,
  original_draft TEXT,
  regenerated_draft TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

This table serves both B1 (immediate feedback) and B2 (self-learning loop).

#### B1c: Frontend — `ResolutionConsoleMVP.tsx`

**Add state variables (near line 50):**
```typescript
const [showFeedback, setShowFeedback] = useState(false);
const [feedbackText, setFeedbackText] = useState('');
const [isRegenerating, setIsRegenerating] = useState(false);
```

**Add handler function (near line 185):**
```typescript
const executeRegenerate = async () => {
  if (!feedbackText.trim()) return;
  setIsRegenerating(true);
  try {
    const res = await fetch(`/api/hub/ticket/${ticket.id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedbackText: feedbackText.trim(),
        currentDraft: sharedState.editedResponse || ticket.draftResponse,
        currentCategory: ticket.category
      })
    });
    const data = await res.json();
    if (data.success) {
      onSharedStateChange({
        ...sharedState,
        editedResponse: data.data.regeneratedDraft,
        isProofed: false // must re-proof after regeneration
      });
      setFeedbackText('');
      setShowFeedback(false);
    }
  } catch (err) {
    console.error('Regenerate failed:', err);
  } finally {
    setIsRegenerating(false);
  }
};
```

**Add FEEDBACK button (between Edit and Proof buttons, around line 704):**
```tsx
<button
  onClick={() => setShowFeedback(!showFeedback)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-label font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
>
  <span className="material-symbols-outlined !text-[14px]">rate_review</span>
  Feedback
</button>
```

**Add feedback input panel (below the draft editor, conditionally rendered):**
```tsx
{showFeedback && (
  <div className="border-t border-outline-variant p-4 bg-amber-50/30">
    <label className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500 mb-2 block">
      Tell us what to change
    </label>
    <textarea
      value={feedbackText}
      onChange={(e) => setFeedbackText(e.target.value)}
      placeholder="e.g. Wrong category — this is a return request. Rewrite with warmer tone."
      className="w-full p-3 text-sm font-body border border-outline-variant rounded resize-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
      rows={3}
    />
    <div className="flex justify-end mt-2 gap-2">
      <button
        onClick={() => { setShowFeedback(false); setFeedbackText(''); }}
        className="px-3 py-1.5 text-xs font-label text-zinc-500 hover:text-zinc-800"
      >
        Cancel
      </button>
      <button
        onClick={executeRegenerate}
        disabled={isRegenerating || !feedbackText.trim()}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-label font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        {isRegenerating ? (
          <><span className="material-symbols-outlined !text-[12px] animate-spin">refresh</span> Regenerating...</>
        ) : (
          <><span className="material-symbols-outlined !text-[12px]">auto_fix_high</span> Regenerate Draft</>
        )}
      </button>
    </div>
  </div>
)}
```

**Acceptance criteria:**
- Feedback button appears in ResolutionConsoleMVP between Edit and Proof
- Clicking opens a textarea input
- Typing feedback and clicking "Regenerate Draft" calls the API
- API returns a revised draft that replaces the current editor content
- Proof state resets to `unproofed` (operator must re-proof)
- Feedback is stored in `operator_feedback` table
- TOV cleanup is applied to the regenerated draft
- Gold responses for the (corrected) category are used as few-shot context

**Dependencies:** Requires `operator_feedback` table (B1b). Can be created inline as self-contained SQL in the endpoint.

---

### E1: Show "Existing Customer" Flag on UI

**Current state (confirmed):** The `customer_profiles` table already has:
- `shopify_customer_id` (text) — populated from Shopify CSV import
- `shopify_order_count` (integer) — number of orders
- `shopify_ltv` (numeric 10,2) — lifetime value in dollars

The hub.ts ticket hydration query (lines 197-207) already fetches `cp.shopify_order_count` and `cp.shopify_ltv`.

The ResolutionConsoleMVP.tsx already conditionally renders a "Customer Value" section (lines 340-359) showing orders and LTV — **but only when the console is expanded**.

**What's missing:** There's no at-a-glance "Existing Customer" / "New Contact" badge visible in the collapsed view or the ticket queue.

**Implementation:**

1. **ResolutionConsoleMVP.tsx badges section (around line 287):** Add between the existing "Repeat Customer" and "High Attention" badges:
   ```tsx
   {customer.shopifyOrderCount && customer.shopifyOrderCount > 0 && (
     <span className="px-2 py-0.5 text-[9px] font-label font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
       Shopify Customer
     </span>
   )}
   {(!customer.shopifyOrderCount || customer.shopifyOrderCount === 0) && (
     <span className="px-2 py-0.5 text-[9px] font-label font-bold rounded bg-zinc-100 text-zinc-500 border border-zinc-200">
       New Contact
     </span>
   )}
   ```

2. **Verify data is flowing:** Query DB to confirm Shopify import populated `shopify_order_count`:
   ```sql
   SELECT COUNT(*) as total, COUNT(shopify_order_count) as with_shopify
   FROM customer_profiles;
   ```

**Acceptance criteria:**
- "Shopify Customer" badge (green) shows for profiles with `shopify_order_count > 0`
- "New Contact" badge (grey) shows for profiles without Shopify data
- Badge is visible in both collapsed and expanded console views
- No new API changes needed — data already flows through

**Dependencies:** None

---

### A3: Confirm Send Actually Went Through

**Current state (confirmed):** `send_audit` table exists (migration 0004) with columns:
- `initial_draft`, `final_message_sent`, `was_human_edited`, `was_proofed`, `resolution_mechanism`, `sent_at`
- INSERT runs in `hub.ts` lines 1074-1089 after successful Graph API sendMail

The HUD already shows a "SENT" badge after dispatch. The ticket's `send_status` is updated to `'sent'`.

**What Heidi wants:** Confidence that the email actually arrived — not just that the API call succeeded.

**Implementation:**

1. **Verify current audit is working:** Run `/db-check` on a recently sent ticket and confirm `send_audit` row exists with correct `final_message_sent` and `sent_at`.

2. **Add sent confirmation detail to the SENT state in ResolutionConsoleMVP.tsx.** After sending (when `proofState === 'sent'`), show:
   ```tsx
   <div className="text-center py-4">
     <span className="material-symbols-outlined text-green-600 !text-[32px]">check_circle</span>
     <p className="font-label text-sm font-semibold text-green-700 mt-2">Response sent</p>
     <p className="font-body text-xs text-zinc-500 mt-1">
       Sent via info@sagitine.com at {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
     </p>
     <p className="font-body text-xs text-zinc-400 mt-0.5">
       Delivery confirmed — saved to Sent Items and send_audit
     </p>
   </div>
   ```

3. **Future enhancement (not this sprint):** Graph API message trace to verify delivery status — out of scope for now.

**Acceptance criteria:**
- After sending, user sees a confirmation with timestamp and sender address
- `send_audit` row exists for every sent ticket (verify with /db-check)

**Dependencies:** None

---

### D2: Email ID Traceability

**Current state:** Make.com sends `message_id` (the Outlook Graph ID) to `/api/classify`, which stores it in `inbound_emails`. The draft body includes `<!--EMAIL_ID:{{1.id}}-->` as a hidden comment.

**Verification task:**

1. Query a recent ticket and confirm the chain:
   ```sql
   SELECT t.id as ticket_id, ie.id as email_id, ie.message_id as outlook_id,
          ie.from_email, ie.subject
   FROM tickets t
   JOIN inbound_emails ie ON t.email_id = ie.id
   ORDER BY t.created_at DESC LIMIT 5;
   ```

2. Confirm `ie.message_id` matches the Outlook Graph email ID format (`AAMkADIz...`)

3. Check the draft in `02_AI Drafted` folder — confirm the `<!--EMAIL_ID:...-->` comment contains the same ID

**Acceptance criteria:**
- Every ticket can be traced back to the exact Outlook email
- IDs are consistent between Make.com, Neon DB, and Outlook folder

**Dependencies:** D1 should be completed first (so we know originals are filing correctly)

---

## Phase 3 — Intelligence Layer (P1-P2)

### B2: Self-Learning Loop — Original Draft vs Final Sent

**Problem:** The system generates drafts but never learns from operator corrections. Heidi fixes the same types of errors repeatedly.

**Current data (confirmed):** `send_audit` already stores:
- `initial_draft` — the AI-generated draft
- `final_message_sent` — what actually got sent (after human edits + proofing)
- `was_human_edited` — boolean flag
- `was_proofed` — boolean flag

The `operator_feedback` table from B1 will store explicit feedback text.

**Implementation — phased approach:**

#### B2a: Create `learning_signals` table

```sql
CREATE TABLE IF NOT EXISTS learning_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'category_correction', 'tone_adjustment', 'content_rewrite', 'template_match'
  original_category TEXT,
  corrected_category TEXT,
  original_draft TEXT,
  final_draft TEXT,
  edit_distance_ratio NUMERIC(5,4), -- 0.0 (identical) to 1.0 (complete rewrite)
  operator_feedback_text TEXT, -- from operator_feedback table if available
  extracted_pattern TEXT, -- what the system learned, in natural language
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

#### B2b: Signal extraction on send

In `hub.ts` dispatch function, after the `send_audit` INSERT (line ~1089), add:

```typescript
// Extract learning signal if operator made significant edits
if (ctx.reply_body && htmlToSend) {
  const originalPlain = ctx.reply_body.replace(/<[^>]+>/g, '').trim();
  const finalPlain = htmlToSend.replace(/<[^>]+>/g, '').trim();
  const maxLen = Math.max(originalPlain.length, finalPlain.length);
  const editDistance = levenshteinRatio(originalPlain, finalPlain); // implement or use simple heuristic

  if (editDistance > 0.15) { // >15% different = significant edit
    await sql`
      INSERT INTO learning_signals (ticket_id, signal_type, original_category, original_draft, final_draft, edit_distance_ratio)
      VALUES (${ticketId}, 'content_rewrite', ${ctx.category_primary}, ${ctx.reply_body}, ${finalPlain}, ${editDistance})
    `;
  }
}
```

For edit distance, use a simple ratio heuristic (no need for full Levenshtein on large texts):
```typescript
function editDistanceRatio(a: string, b: string): number {
  if (a === b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  // Simple word-level diff ratio
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const union = new Set([...wordsA, ...wordsB]);
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  return 1 - (intersection.length / union.size);
}
```

#### B2c: Feed signals into classify prompt

In `api/classify.ts`, before calling Claude Haiku for draft generation, query recent learning signals for the detected category:

```typescript
const recentCorrections = await sql`
  SELECT original_draft, final_draft, operator_feedback_text, extracted_pattern
  FROM learning_signals
  WHERE original_category = ${category}
  AND created_at > NOW() - INTERVAL '30 days'
  ORDER BY created_at DESC
  LIMIT 3
`;
```

Inject as context in the Claude prompt:
```
PAST CORRECTIONS FOR THIS CATEGORY (learn from these):
${recentCorrections.map(c => `- Original: "${c.original_draft?.substring(0,100)}..." → Corrected: "${c.final_draft?.substring(0,100)}..." ${c.operator_feedback_text ? `Feedback: ${c.operator_feedback_text}` : ''}`).join('\n')}
```

#### B2d: Karpathy-style self-improvement (future research)

This is Phase 3+ territory. The approach:
- Collect preference pairs from `send_audit` (initial_draft = rejected, final_message_sent = preferred)
- Use these for DPO/RLHF-style fine-tuning if we move to a custom model
- For now, the few-shot retrieval approach (B2c) gives 80% of the value

**Acceptance criteria:**
- `learning_signals` table exists and receives rows on every send where edits were significant
- Classify prompt includes recent correction examples for the detected category
- No regression in classification accuracy (monitor over 1 week)

**Dependencies:** B1 (operator_feedback table and data), A1 (accurate final_message_sent)

---

### G1: Categorisation Accuracy Tuning

**Status:** BLOCKED — waiting on Heidi to provide specific miscategorised email examples.

**When unblocked, the approach:**

1. Pull the specific ticket IDs Heidi identifies
2. Compare `triage_results.category_primary` vs Heidi's correct category
3. Check if keyword rules in `classify.ts` (the `CATEGORY_RULES` array, lines 30-260) have gaps
4. Check if the Claude Haiku prompt needs refinement for edge cases
5. Add the corrections as learning signals (B2) so the system self-corrects

**Dependencies:** B1 (allows Heidi to correct categories inline), B2 (stores corrections for future learning)

---

## Phase 4 — Operator Confidence (P2)

### F1: Morning Brief

**Problem:** Heidi currently opens Outlook, scans Inbox, and mentally prioritises. With emails now filed into multiple folders, she fears missing something. The Morning Brief gives a single-screen summary of everything that needs attention.

**Proposed UX:** Button on the NotificationPill (the floating "S" button, file: `src/features/notification-hub/components/NotificationPill.tsx`). Click opens a modal/panel.

**Files to create/modify:**

#### F1a: New API endpoint — `GET /api/hub/brief/morning`

Returns:
```json
{
  "success": true,
  "data": {
    "date": "2026-04-07",
    "needsResponse": [
      { "ticketId": "...", "customerName": "...", "subject": "...", "urgency": "high", "waitingMinutes": 120, "category": "..." }
    ],
    "newSinceYesterday": 5,
    "totalOpen": 13,
    "urgentCount": 3,
    "oldestUnanswered": { "customerName": "...", "waitingMinutes": 2243 },
    "coverageCheck": {
      "dbTicketCount": 13,
      "note": "All inbound emails are accounted for in the HUD"
    }
  }
}
```

Query: all tickets where `status NOT IN ('archived','rejected') AND send_status != 'sent'`, ordered by urgency DESC then received_at ASC.

#### F1b: Frontend — Morning Brief modal

New component `src/features/notification-hub/components/MorningBrief.tsx`.
Button added to `NotificationPill.tsx` as a secondary action (small icon to the left of the chest icon).

**Acceptance criteria:**
- Morning Brief button visible on the pill
- Click shows a panel listing all tickets needing response, sorted by urgency
- Shows total count, urgent count, oldest item
- Operator has confidence nothing is missing

**Dependencies:** None

---

### F2: Evening Brief / End-of-Day Summary

**Similar to F1 but retrospective.**

#### F2a: New API endpoint — `GET /api/hub/brief/evening`

Returns:
```json
{
  "success": true,
  "data": {
    "date": "2026-04-07",
    "actioned": [
      { "ticketId": "...", "customerName": "...", "subject": "...", "action": "sent", "sentAt": "..." }
    ],
    "actionedCount": 8,
    "stillOpen": [
      { "ticketId": "...", "customerName": "...", "subject": "...", "urgency": "medium", "waitingMinutes": 300 }
    ],
    "stillOpenCount": 5,
    "newArrivedToday": 3,
    "summary": "8 of 13 tickets resolved today. 5 carry over to tomorrow."
  }
}
```

Query actioned: tickets where `send_status = 'sent' AND sent_at::date = CURRENT_DATE`.
Query still open: tickets where `status NOT IN ('archived','rejected') AND send_status != 'sent'`.

#### F2b: Frontend — reuse MorningBrief component with a toggle

Add a tab/toggle: "Morning" | "Evening" at the top of the brief panel.

**Acceptance criteria:**
- Evening Brief shows what was done today and what carries over
- Gives Heidi confidence at end of day that nothing was missed
- Count of actioned matches send_audit rows for the day

**Dependencies:** F1 (shared UI component)

---

## Summary — Execution Order

| Order | Task | Type | Est. Complexity | Dependencies |
|-------|------|------|-----------------|--------------|
| 1 | C1 — Proofing bug fix | Bug fix | Small | None |
| 2 | E2 — Time format | UI fix | Small | None |
| 3 | D1 — Move original email | Make.com config | Small | None (not code) |
| 4 | A2 — Verify sender | Verification | Tiny | None |
| 5 | A1 — Email format match Outlook | Backend | Medium | None |
| 6 | B1 — Immediate Feedback button | Full-stack | Large | Creates operator_feedback table |
| 7 | E1 — Existing customer badge | UI | Small | None |
| 8 | A3 — Send confirmation UI | UI | Small | None |
| 9 | D2 — Email ID traceability | Verification | Small | D1 |
| 10 | B2 — Self-learning loop | Backend + AI | Large | B1, A1 |
| 11 | G1 — Category tuning | AI/prompt | Medium | Blocked on Heidi |
| 12 | F1 — Morning Brief | Full-stack | Medium | None |
| 13 | F2 — Evening Brief | Full-stack | Medium | F1 |

**Parallelisation opportunities:**
- C1, E2, A2 can all run in parallel (no shared files)
- A1 and B1 modify `hub.ts` — run sequentially or in separate worktrees
- E1 and A3 modify `ResolutionConsoleMVP.tsx` — run sequentially
- F1 and F2 are new files — can run in parallel after Phase 2
