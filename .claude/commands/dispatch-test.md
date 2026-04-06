# /dispatch-test — Test Live Dispatch Endpoint

Usage: `/dispatch-test <ticket-id>`

Runs a full dispatch test against a live ticket and verifies every step: Graph token, email send, DB writes. Use this to confirm the Microsoft Graph integration is working end-to-end without going through the HUD UI.

⚠️ **This sends a real email.** Only use it against a test ticket (e.g. your own email address as the sender).

## Steps

### 1. Resolve ticket
`$ARGUMENTS` is the ticket ID. If none provided, show the 3 most recent non-sent tickets from Neon so the user can pick one:
```bash
cd sagitine-hud && node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT t.id, t.send_status, ie.from_email, ie.subject FROM tickets t JOIN inbound_emails ie ON t.email_id = ie.id WHERE t.send_status != 'sent' ORDER BY t.created_at DESC LIMIT 3\`.then(r => console.log(JSON.stringify(r, null, 2)));
"
```
Warn the user that this will send a real email to the `from_email` address shown.

### 2. Check env vars are set
```bash
cd sagitine-hud && vercel env ls | grep MICROSOFT
```
All four must be present: `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_SENDER_EMAIL`. If any are missing, stop and say which ones.

### 3. Call dispatch endpoint
```bash
curl -s -X POST https://sagitine-hud.vercel.app/api/hub/ticket/<TICKET_ID>/dispatch \
  -H "Content-Type: application/json" \
  -d '{"final_message_sent": "<p>Test dispatch from /dispatch-test skill. Please ignore.</p>"}' | jq .
```

### 4. Verify DB writes
After a 200 response, confirm all three DB writes happened:
```bash
cd sagitine-hud && node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);
const id = '<TICKET_ID>';
Promise.all([
  sql\`SELECT send_status, sent_at FROM tickets WHERE id = \${id}\`,
  sql\`SELECT id, sent_at FROM send_audit WHERE ticket_id = \${id}\`,
  sql\`SELECT last_contact_at FROM customer_profiles cp JOIN inbound_emails ie ON ie.from_email = cp.email JOIN tickets t ON t.email_id = ie.id WHERE t.id = \${id}\`
]).then(([ticket, audit, profile]) => console.log(JSON.stringify({ ticket: ticket[0], audit: audit[0], profile: profile[0] }, null, 2)));
"
```

### 5. Report
```
Dispatch test — Ticket <id>
─────────────────────────────────────
✅ Graph token acquired
✅ Email sent → <to_email>
✅ tickets.send_status = 'sent' (sent_at: <timestamp>)
✅ send_audit row written (id: <id>)
✅ customer_profiles.last_contact_at updated
   response_time_minutes: <N>
   crm_updated: true
```

If the dispatch returned an error, diagnose from the message:
- `Microsoft Graph env vars not configured` → missing Vercel env vars
- `Graph token error` → wrong tenant/client credentials
- `Graph sendMail error (403)` → Mail.Send permission not granted or admin consent missing
- `Already sent` → ticket already dispatched, pick a different one
