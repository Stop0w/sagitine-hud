# /proof-check — Test Live Proof Endpoint

Usage: `/proof-check <ticket-id>`

Tests the real Claude Haiku proof endpoint against a live ticket. Use this to confirm the proof API is working correctly, TOV rules are applying, and the mock is not being used.

## Steps

### 1. Resolve the ticket ID
`$ARGUMENTS` is the ticket ID. If none was provided, query Neon for the most recent non-sent ticket:
```bash
cd sagitine-hud && node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT t.id, ie.from_name, ie.subject FROM tickets t JOIN inbound_emails ie ON t.email_id = ie.id WHERE t.send_status != 'sent' AND t.status NOT IN ('archived','rejected') ORDER BY t.created_at DESC LIMIT 3\`.then(r => console.log(JSON.stringify(r, null, 2)));
"
```
Show the results and ask the user which ticket to test if no ID was given.

### 2. Fetch the draft text for that ticket
```bash
cd sagitine-hud && node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT tr.reply_body FROM tickets t JOIN triage_results tr ON t.triage_result_id = tr.id WHERE t.id = '<TICKET_ID>'\`.then(r => console.log(r[0]?.reply_body));
"
```

### 3. Call the proof endpoint
Use curl against the production URL:
```bash
curl -s -X POST https://sagitine-hud.vercel.app/api/hub/ticket/<TICKET_ID>/proof \
  -H "Content-Type: application/json" \
  -d '{"draftText": "<PLAIN_TEXT_DRAFT>", "operatorEdited": false}' | jq .
```
Strip HTML tags from `reply_body` before sending as `draftText`.

### 4. Report results
Show a clear summary:
```
Ticket:      <id> — <customer name> — <subject>
Status:      ✅ Real Claude Haiku response (not mock)

Proof status:    proofed | warning
Changes detected: yes | no
TOV compliance:   tone: pass | grammar: pass | clarity: pass

Suggestions:
  • [medium] <message>
  • [low]    <message>

Corrected draft:
<corrected text>
```

If the response contains the mock's hardcoded messages ("Removed duplicate sign-off", "Adjusted empathy in opening sentence") — flag it immediately: "⚠️ MOCK IS ACTIVE — check VITE_MOCK_PROOFING in .env".

If the endpoint returns an error, show the raw response and diagnose: missing ANTHROPIC_API_KEY, wrong ticket ID, etc.
