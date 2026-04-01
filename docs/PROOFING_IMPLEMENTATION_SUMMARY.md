# Proofing Flow & Backend Contract Implementation

> **Status**: ✅ Complete - All MVP requirements implemented
> **Date**: 2026-04-01
> **Migration**: `0004_keen_dragon_lord.sql` applied successfully

---

## 1. Endpoints Changed

### New Endpoint

**POST /api/hub/ticket/:id/proof**
- Real-time draft proofing using Claude Haiku
- Analyzes current draft text (not just AI-generated original)
- Returns structured corrections and suggestions
- Persists proof audit trail

### Updated Endpoints

**GET /api/hub/ticket/:ticketId**
- Added `ticket.waitingMinutes` (duration since inbound receipt)
- Added `customer.lastContactCategory` (previous ticket category)
- Added `customer.patternSummary` (null for MVP)

**POST /api/tickets/:id/sent**
- Enhanced with complete audit persistence
- Tracks initial draft vs final sent message
- Records resolution mechanism (ai_drafted | human_edited | human_proofed)
- Updates customer profile `lastContactCategory`

---

## 2. Schema Changes

### New Tables

#### `draft_proofs`
```sql
CREATE TABLE draft_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  input_draft TEXT NOT NULL,
  corrected_draft TEXT,
  changes_detected BOOLEAN NOT NULL DEFAULT FALSE,
  suggestions JSONB DEFAULT '[]',
  proof_status TEXT NOT NULL DEFAULT 'proofed',
  operator_edited BOOLEAN NOT NULL DEFAULT FALSE,
  proof_model TEXT NOT NULL DEFAULT 'claude-haiku',
  proofed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Audit trail for all proofing requests. Enables AI efficacy analysis by tracking:
- What draft was submitted
- What corrections were suggested
- Whether changes were detected
- Proof model version used

#### `send_audit`
```sql
CREATE TABLE send_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  initial_draft TEXT NOT NULL,
  final_message_sent TEXT NOT NULL,
  confidence_rating NUMERIC(4,3) NOT NULL,
  was_human_edited BOOLEAN NOT NULL DEFAULT FALSE,
  was_proofed BOOLEAN NOT NULL DEFAULT FALSE,
  resolution_mechanism TEXT NOT NULL,
  proof_id UUID REFERENCES draft_proofs(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Complete audit trail for sent messages. Tracks:
- Initial AI draft vs final sent message
- Human editing and proofing activity
- Resolution mechanism classification
- Confidence rating for efficacy analysis

---

## 3. Final Request/Response Contracts

### POST /api/hub/ticket/:id/proof

#### Request
```json
{
  "draftText": "Hi Sarah,\n\nThanks for reaching out. Warm regards, Warm regards,\nHeidi x",
  "operatorEdited": true
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "proofStatus": "proofed",
    "changesDetected": true,
    "correctedDraft": "Hi Sarah,\n\nThanks for reaching out.\n\nWarm regards,\nHeidi x",
    "suggestions": [
      {
        "type": "duplication",
        "severity": "medium",
        "message": "Duplicate sign-off detected: 'Warm regards, Warm regards'"
      }
    ],
    "summary": {
      "tone": "pass",
      "grammar": "fixes_applied",
      "clarity": "pass",
      "risk": "low"
    },
    "proofedAt": "2026-04-01T10:30:00.000Z"
  },
  "timestamp": "2026-04-01T10:30:00.000Z"
}
```

### GET /api/hub/ticket/:ticketId (Updated Fields)

#### Response (New Fields)
```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "uuid",
      "waitingMinutes": 45, // NEW: Duration since received
      // ... other ticket fields
    },
    "customer": {
      "id": "uuid",
      "lastContactCategory": "Shipping & Delivery", // NEW: Previous ticket category
      "patternSummary": null, // NEW: AI pattern analysis (null for MVP)
      // ... other customer fields
    }
  }
}
```

### POST /api/tickets/:id/sent (Enhanced)

#### Request
```json
{
  "final_message_sent": "The actual message sent by Outlook"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "ticket_id": "uuid",
    "send_status": "sent",
    "sent_at": "2026-04-01T10:30:00.000Z"
  },
  "message": "Send status updated and audit recorded",
  "timestamp": "2026-04-01T10:30:00.000Z"
}
```

**Backend Side-Effects** (Automatic):
1. Insert `send_audit` record with:
   - `initialDraft` from triage_results.reply_body
   - `finalMessageSent` from request or human_edited_body
   - `confidenceRating` from triage_results.confidence
   - `wasHumanEdited` from tickets.human_edited
   - `wasProofed` (checks for recent draft_proofs record)
   - `resolutionMechanism` (ai_drafted | human_edited | human_proofed)

2. Update `customer_profiles.lastContactCategory` with current ticket's category

---

## 4. Frontend Changes Required

### A. Proof Workflow Integration

**Current State**: Proof button exists but mocked/static

**Required Changes**:

1. **Replace mock proof with real backend call**:
```typescript
// Current: Local state or mock
const handleProof = async () => {
  // TODO: Call proof endpoint
  setIsProofed(true);
};

// Updated: Real backend integration
const handleProof = async () => {
  const response = await fetch(`/api/hub/ticket/${ticketId}/proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draftText: currentDraft,
      operatorEdited: hasBeenEdited
    })
  });

  const { data } = await response.json();

  if (data.changesDetected) {
    // Show suggestions panel
    setSuggestions(data.suggestions);
    setCorrectedDraft(data.correctedDraft);
  }

  setProofStatus(data.proofStatus);
};
```

2. **Render suggestions panel** (new UI component):
```typescript
<div className="proof-suggestions">
  {suggestions.map(s => (
    <div key={s.id} className={`suggestion ${s.severity}`}>
      <span className="type">{s.type}</span>
      <span className="message">{s.message}</span>
    </div>
  ))}
</div>
```

3. **Apply corrections action**:
```typescript
const applyCorrections = () => {
  setCurrentDraft(correctedDraft);
  setSuggestions([]);
  // Send state back to EDIT until re-proofed
};
```

### B. HUD Hydration Updates

**New Fields to Display**:

1. **Waiting Minutes** (Ticket context):
```typescript
<WaitingTime value={ticket.waitingMinutes} />
// Renders: "45 min wait"
```

2. **Last Contact Category** (Customer stats):
```typescript
<LastContact>
  Last: {customer.lastContactCategory || 'N/A'}
</LastContact>
```

3. **Pattern Summary** (Customer stats - MVP):
```typescript
{customer.patternSummary && (
  <PatternAlert>{customer.patternSummary}</PatternAlert>
)}
// Currently null for MVP, hide component
```

---

## 5. Test Plan

### A. Proof Endpoint Tests

#### Test A1: Duplicate Sign-Off Detection
**Input**:
```json
{
  "draftText": "Hi Sarah,\n\nThanks for reaching out.\n\nWarm regards, Warm regards,\nHeidi x",
  "operatorEdited": false
}
```

**Expected**:
```json
{
  "changesDetected": true,
  "correctedDraft": "Hi Sarah,\n\nThanks for reaching out.\n\nWarm regards,\nHeidi x",
  "suggestions": [
    {
      "type": "duplication",
      "severity": "medium",
      "message": "Duplicate sign-off: 'Warm regards, Warm regards'"
    }
  ]
}
```

**Verification**:
- ✅ `changesDetected` = true
- ✅ `correctedDraft` removes duplication
- ✅ `suggestions` includes duplication type

#### Test A2: Grammar & Spelling (AU English)
**Input**:
```json
{
  "draftText": "Hi Sarah,\n\nI apologise for the color issue. We will honor our warrantee.\n\nWarm regards,\nHeidi x",
  "operatorEdited": false
}
```

**Expected**:
```json
{
  "changesDetected": true,
  "suggestions": [
    {
      "type": "spelling",
      "severity": "low",
      "message": "Changed 'color' to Australian English 'colour'"
    },
    {
      "type": "spelling",
      "severity": "medium",
      "message": "Changed 'warrantee' to 'warranty'"
    }
  ]
}
```

#### Test A3: Tone Check (No Over-Apologizing)
**Input**:
```json
{
  "draftText": "Hi Sarah,\n\nI'm so sorry about this. We apologize for the inconvenience.\n\nWarm regards,\nHeidi x",
  "operatorEdited": false
}
```

**Expected**:
```json
{
  "summary": {
    "tone": "fixes_applied"
  },
  "suggestions": [
    {
      "type": "tone",
      "severity": "medium",
      "message": "Replaced apologies with Sagitine tone: 'Thank you for reaching out'"
    }
  ]
}
```

#### Test A4: Risk Detection
**Input**:
```json
{
  "draftText": "Hi Sarah,\n\nWe'll give you a full refund plus $50 compensation.\n\nWarm regards,\nHeidi x",
  "operatorEdited": false
}
```

**Expected**:
```json
{
  "summary": {
    "risk": "high"
  },
  "suggestions": [
    {
      "type": "risk",
      "severity": "high",
      "message": "Do not offer refunds or compensation not already present in policy"
    }
  ]
}
```

### B. Hydration Tests

#### Test B1: Waiting Minutes Calculation
**Request**: `GET /api/hub/ticket/{ticketReceived45MinAgo}`

**Expected**:
```json
{
  "ticket": {
    "waitingMinutes": 45
  }
}
```

**Verification**:
- ✅ `waitingMinutes` is integer
- ✅ Value is approximately correct (±1 minute tolerance)

#### Test B2: Last Contact Category
**Setup**: Customer has previous ticket in `shipping_delivery_order_issue`

**Request**: `GET /api/hub/ticket/{currentDamagedFaultyTicket}`

**Expected**:
```json
{
  "customer": {
    "lastContactCategory": "Shipping & Delivery"
  }
}
```

**Verification**:
- ✅ Returns previous ticket's category label (human-readable)
- ✅ Excludes current ticket
- ✅ Returns null if no previous tickets

#### Test B3: Pattern Summary (MVP)
**Request**: `GET /api/hub/ticket/{anyTicket}`

**Expected**:
```json
{
  "customer": {
    "patternSummary": null
  }
}
```

**Verification**:
- ✅ Field exists in payload
- ✅ Value is null (MVP-safe collapse)

### C. Send Audit Tests

#### Test C1: AI-Drafted (No Edits)
**Setup**: Ticket with `humanEdited: false`, no proof record

**Request**: `POST /api/tickets/:id/sent`

**Backend Verification**:
```sql
SELECT * FROM send_audit WHERE ticket_id = :id;

-- Expected:
{
  resolution_mechanism: 'ai_drafted',
  was_human_edited: false,
  was_proofed: false,
  initial_draft: "<AI-generated>",
  final_message_sent: "<AI-generated>"
}
```

#### Test C2: Human-Edited (With Proof)
**Setup**: Ticket with `humanEdited: true`, recent draft_proofs record

**Request**: `POST /api/tickets/:id/sent`

**Backend Verification**:
```sql
SELECT * FROM send_audit WHERE ticket_id = :id;

-- Expected:
{
  resolution_mechanism: 'human_proofed',
  was_human_edited: true,
  was_proofed: true,
  proof_id: <uuid>,
  initial_draft: "<original AI>",
  final_message_sent: "<human-edited version>"
}
```

#### Test C3: Customer Profile Update
**Request**: `POST /api/tickets/:id/sent` (current ticket category: `damaged_missing_faulty`)

**Backend Verification**:
```sql
SELECT last_contact_category FROM customer_profiles
WHERE id = (SELECT customer_profile_id FROM inbound_emails JOIN tickets ON tickets.email_id = inbound_emails.id WHERE tickets.id = :id);

-- Expected:
{ last_contact_category: 'damaged_missing_faulty' }
```

---

## 6. Acceptance Criteria

### ✅ Complete

1. **Proof Endpoint**: POST /api/hub/ticket/:id/proof
   - ✅ Uses Claude Haiku for analysis
   - ✅ Returns structured JSON with correctedDraft, suggestions, summary
   - ✅ Detects duplication (e.g., "Warm regards, Warm regards")
   - ✅ Checks spelling, grammar, tone, clarity, risk
   - ✅ Persists proof audit in draft_proofs table
   - ✅ Minimal edits faithful to intent
   - ✅ AU spelling preference

2. **Send Audit Enhancement**: POST /api/tickets/:id/sent
   - ✅ Persists initialDraft vs finalMessageSent
   - ✅ Records confidenceRating
   - ✅ Tracks wasHumanEdited, wasProofed
   - ✅ Classifies resolutionMechanism (ai_drafted | human_edited | human_proofed)
   - ✅ Updates customer.lastContactCategory

3. **Hydration Gaps Closed**: GET /api/hub/ticket/:ticketId
   - ✅ waitingMinutes calculated and returned
   - ✅ lastContactCategory queried and returned
   - ✅ patternSummary included (null for MVP)

4. **Schema Changes**:
   - ✅ draft_proofs table created
   - ✅ send_audit table created
   - ✅ Migration applied successfully

---

## 7. Deployment Checklist

- [ ] Verify ANTHROPIC_API_KEY is set in production environment
- [ ] Run migration: `npx drizzle-kit push`
- [ ] Test proof endpoint with real ticket data
- [ ] Verify send audit records are created on send callback
- [ ] Confirm customer profile lastContactCategory updates
- [ ] Monitor Claude Haiku API usage and costs
- [ ] Set up alerts for proof endpoint errors/failures

---

## 8. Known Limitations (MVP)

1. **Pattern Summary**: Returns null (not yet implemented)
   - **Future path**: Generate from `thirtyDayVolume` + category clustering

2. **Proof Fallback**: If Claude Haiku fails, returns draft unchanged
   - **Monitored via**: `proof_status` field in draft_proofs table

3. **Proof-Edit Cycle**: Frontend must manage edit→proof→send state machine
   - **Backend provides**: Structured suggestions and corrected draft
   - **Frontend owns**: When to allow send after edit

---

## Summary

All MVP requirements have been implemented:

✅ **Real proof endpoint** using Claude Haiku
✅ **Structured proof response** with suggestions and corrections
✅ **Proof audit persistence** in draft_proofs table
✅ **Send audit enhancement** tracking initial vs final message
✅ **Hydration gaps closed** (waitingMinutes, lastContactCategory, patternSummary)
✅ **Schema migrations** applied successfully

**Ready for IDE integration and testing.**
