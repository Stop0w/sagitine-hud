# /db-check — Neon Database Status Check

Usage: `/db-check` or `/db-check <ticket-id>`

Queries Neon to verify the state of recent tickets and their associated DB records. Use this after a send to confirm everything was written correctly, or to diagnose why a ticket isn't appearing in the HUD queue.

`$ARGUMENTS` is an optional ticket ID. If provided, show detailed info for that ticket only. If omitted, show the last 10 tickets.

## Steps

### 1. Run the query

**If a ticket ID was given:**
```bash
cd sagitine-hud && node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);
const id = process.argv[1];
Promise.all([
  sql\`SELECT t.id, t.status, t.send_status, t.sent_at, t.created_at, ie.from_email, ie.from_name, ie.subject, ie.received_at FROM tickets t JOIN inbound_emails ie ON t.email_id = ie.id WHERE t.id = \${id}\`,
  sql\`SELECT id, sent_at, was_proofed, was_human_edited, resolution_mechanism FROM send_audit WHERE ticket_id = \${id}\`,
  sql\`SELECT cp.last_contact_at, cp.last_contact_category, cp.total_contact_count FROM customer_profiles cp JOIN inbound_emails ie ON ie.from_email = cp.email JOIN tickets t ON t.email_id = ie.id WHERE t.id = \${id}\`,
  sql\`SELECT id, proofed_at FROM draft_proofs WHERE ticket_id = \${id} ORDER BY proofed_at DESC LIMIT 1\`
]).then(([ticket, audit, profile, proof]) => console.log(JSON.stringify({ ticket: ticket[0], send_audit: audit[0] || null, customer_profile: profile[0] || null, latest_proof: proof[0] || null }, null, 2)));
" "$ARGUMENTS"
```

**If no ticket ID:**
```bash
cd sagitine-hud && node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);
sql\`
  SELECT 
    t.id, t.status, t.send_status, t.sent_at,
    ie.from_name, ie.subject, ie.received_at,
    EXISTS(SELECT 1 FROM send_audit sa WHERE sa.ticket_id = t.id) as has_audit,
    EXISTS(SELECT 1 FROM draft_proofs dp WHERE dp.ticket_id = t.id) as has_proof
  FROM tickets t 
  JOIN inbound_emails ie ON t.email_id = ie.id
  ORDER BY t.created_at DESC 
  LIMIT 10
\`.then(r => console.log(JSON.stringify(r, null, 2)));
"
```

### 2. Display results

**Summary table (no ticket ID):**
```
Recent Tickets (last 10)
──────────────────────────────────────────────────────────────
ID          Customer          Subject                  Status    Send      Proofed  Audited
<id>        Hayden R          How big are the milan    triaged   pending   ✅       ❌
<id>        Verónica L.       Shopping abroad          approved  sent ✅   ✅       ✅
```

**Detailed view (single ticket):**
```
Ticket <id>
─────────────────────────────────────
Customer:    Hayden R <hayden@example.com>
Subject:     How big are the milan boxes
Received:    2026-04-06 16:36
Status:      approved
Send status: sent ✅ (sent_at: 2026-04-06 19:54)

send_audit:  ✅ Written (proofed: true, human_edited: true, mechanism: human_proofed)
draft_proof: ✅ Exists (proofed_at: 2026-04-06 19:52)
customer_profiles: ✅ Updated (last_contact_at: 2026-04-06 19:54, category: pre_purchase_question)
```

### 3. Flag anomalies
Highlight anything unusual:
- `send_status = 'sent'` but no `send_audit` row → dispatch completed partially
- `send_status != 'sent'` but ticket is old (>2h) → stuck in queue, may need `/dispatch-test`
- Ticket missing from query entirely → classify failed, check Make.com execution history
- `customer_profile` not updated → customer email not in `customer_profiles` table
