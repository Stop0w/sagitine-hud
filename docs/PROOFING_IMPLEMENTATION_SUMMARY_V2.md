You are implementing the Sagitine AI CX Agent frontend against the now-final backend contract.

This brief replaces earlier assumptions. Use this as the single source of truth for the proofing workflow, send flow, and hydration rendering.

Backend contract is now final
Use the backend exactly as implemented:

1. Proof endpoint
POST /api/hub/ticket/:id/proof

Request:
{
  "draftText": "string",
  "operatorEdited": true
}

Response:
{
  "success": true,
  "data": {
    "proofStatus": "proofed" | "no_changes" | "failed",
    "changesDetected": boolean,
    "correctedDraft": string,
    "suggestions": [
      {
        "type": "grammar" | "tone" | "clarity" | "spelling" | "risk" | "duplication",
        "severity": "low" | "medium" | "high",
        "message": "string"
      }
    ] | null,
    "summary": {
      "tone": "pass" | "fixes_applied" | "warning",
      "grammar": "pass" | "fixes_applied" | "warning",
      "clarity": "pass" | "fixes_applied" | "warning",
      "risk": "low" | "medium" | "high"
    } | null,
    "proofedAt": "ISO_TIMESTAMP"
  },
  "timestamp": "ISO_TIMESTAMP"
}

Important:
- Read proof data from response.data, not the top level.
- suggestions do not include an id field in the contract example.
- correctedDraft is the backend-approved proofed draft for the current editor text.

2. Send callback
POST /api/tickets/:id/sent

Request:
{
  "final_message_sent": "exact current editor text"
}

3. Ticket hydration additions
GET /api/hub/ticket/:ticketId now includes:
- ticket.waitingMinutes
- customer.lastContactCategory
- customer.patternSummary

Frontend implementation requirements

1) Use an explicit proof state machine
Do not use a single loose boolean like isProofed as the main workflow state.

Use:
type ProofState =
  | "not_proofed"
  | "proofing"
  | "proofed"
  | "invalidated"
  | "sending"
  | "send_failed";

This state must control:
- the primary CTA
- whether SEND RESPONSE is allowed
- whether proof results are valid
- whether an edit has revoked proof status

2) Use a proper frontend type for proof response
Implement a typed frontend contract that matches the backend exactly.

Example:
type ProofSuggestionType =
  | "grammar"
  | "tone"
  | "clarity"
  | "spelling"
  | "risk"
  | "duplication";

type ProofSeverity = "low" | "medium" | "high";

interface ProofSuggestion {
  type: ProofSuggestionType;
  severity: ProofSeverity;
  message: string;
}

interface ProofSummary {
  tone: "pass" | "fixes_applied" | "warning";
  grammar: "pass" | "fixes_applied" | "warning";
  clarity: "pass" | "fixes_applied" | "warning";
  risk: "low" | "medium" | "high";
}

interface ProofPayload {
  proofStatus: "proofed" | "no_changes" | "failed";
  changesDetected: boolean;
  correctedDraft: string;
  suggestions: ProofSuggestion[] | null;
  summary: ProofSummary | null;
  proofedAt?: string;
}

interface ProofApiResponse {
  success: boolean;
  data: ProofPayload;
  timestamp: string;
}

3) Keep provenance derived, not manually free-floating
Do not keep provenanceState as a separate source of truth if it can drift.

Render the provenance label from actual state:
- AI Draft
- Human Edited
- Proofed
- Edited After Proof

Base it on:
- whether the user has edited the draft at all
- current proofState
- whether proof was invalidated after a successful proof

4) Local state required
Use at minimum:
- editedResponse: string
- proofState: ProofState
- proofResult: ProofPayload | null
- hasEverBeenEdited: boolean
- proofSubmittedText: string | null
- lastProofedDraft: string | null

5) Proof click behaviour
When PROOF is clicked:
- set proofState = "proofing"
- disable the proof button / CTA
- POST current editor text to /api/hub/ticket/:id/proof
- request body:
  {
    "draftText": editedResponse,
    "operatorEdited": hasEverBeenEdited
  }

On success:
- parse json.data
- store the current submitted text into proofSubmittedText before overwriting editor contents
- overwrite editedResponse with data.correctedDraft
- store proofResult = data
- store lastProofedDraft = data.correctedDraft

Then:
- if data.proofStatus === "failed", set proofState = "not_proofed"
- otherwise set proofState = "proofed"

Important:
Do not add a separate “Apply corrections” step.
Do not require a second user action to apply correctedDraft.
The proof action itself should update the editor immediately.

6) Edit invalidation behaviour
After proof succeeds, any user edit must immediately invalidate that proof.

On any edit:
- if proofState === "proofed", set proofState = "invalidated"
- keep the edited text intact
- remove SEND RESPONSE as the active action
- switch the primary CTA back to PROOF

This is non-negotiable.
The system must never allow send on stale proof results.

7) Button / CTA rules
Use the state machine to drive CTA behaviour exactly:

State: not_proofed
- Primary CTA = PROOF
- SEND RESPONSE disabled or not primary

State: proofing
- Primary CTA shows PROOFING…
- CTA disabled

State: proofed
- Primary CTA = SEND RESPONSE
- Send enabled

State: invalidated
- Primary CTA = PROOF
- Send disabled

State: sending
- Primary CTA shows SENDING…
- All send/proof actions disabled

State: send_failed
- Return primary CTA to SEND RESPONSE or PROOF depending on whether proof is still valid
- show an inline failure state

8) Proof panel rendering
The proof panel must be fully data-driven from proofResult.

Render:
- summary block if present
- suggestions list if present
- a compact “changes applied” notice if changesDetected === true

If proof succeeded and suggestions is null or empty:
- show a minimal verified banner
- do not fabricate suggestion bullets

Do not keep the current static “proofing suggestions applied” block.

9) Suggestions list rendering
Do not assume suggestion.id exists.
Use a safe render key such as:
`${index}-${suggestion.type}-${suggestion.message}`

10) Send flow
SEND RESPONSE must always use the exact current editor text.

When SEND RESPONSE is clicked:
- require proofState === "proofed"
- set proofState = "sending"
- POST to /api/tickets/:id/sent with:
  {
    "final_message_sent": editedResponse
  }

On success:
- refresh queue/ticket state
- remove resolved ticket from HUD
- ensure counts refresh

On failure:
- set proofState = "send_failed"
- keep the draft intact
- show inline error state

11) Hydration rendering rules
Use the updated ticket hydration payload.

Required:
- display ticket.waitingMinutes in Current Inquiry
- display customer.lastContactCategory only if present
- collapse patternSummary cleanly if null

Do not force fallback filler text for patternSummary.

12) No production mock fallback
Do not leave a silent local mock proof path in the production workflow.

If you need temporary local testing fallback:
- keep it dev-only
- put it behind a clear flag
- do not let it masquerade as real proofing

13) Do not follow old pseudocode that adds an “Apply corrections” step
That is not the agreed MVP.
The correct behaviour is:
- proof request
- correctedDraft returned
- editor updated immediately
- proof becomes valid until next edit

Acceptance criteria

A. Initial open
- Draft loads in editor
- Provenance shows AI Draft unless already edited
- Primary CTA is PROOF
- SEND RESPONSE is not active

B. Human edit before proof
- User edits draft
- Provenance becomes Human Edited
- Primary CTA remains PROOF

C. Duplicate sign-off proof test
Given editor text containing:
“Warm regards, Warm regards,”

When user clicks PROOF:
- request goes to backend
- editor updates to correctedDraft
- proof panel shows duplication issue from backend
- proofState becomes "proofed"
- provenance shows Proofed
- SEND RESPONSE becomes active

D. Post-proof invalidation
After proof succeeds, if the user types one character:
- proofState becomes "invalidated"
- provenance shows Edited After Proof
- SEND RESPONSE disables
- PROOF becomes primary again

E. Empty suggestions success case
If backend returns success with suggestions null or empty:
- show minimal verified banner only

F. Send contract
On send:
- request body must be:
  {
    "final_message_sent": editedResponse
  }

G. Nullable hydration
If patternSummary is null:
- field collapses cleanly

Deliverable
Please implement this against the real backend and then return:
1. exact files/components changed
2. final frontend proof state machine
3. final frontend types used for proof API response
4. any remaining mismatch or blocker from the backend contract
5. confirmation that no production mock proofing path remains