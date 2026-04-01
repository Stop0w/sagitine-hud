# Response Strategy Layer - Architecture & Implementation Summary

> **Status**: Architecture Designed & Service Created - Ready for Integration
> **Date**: 2026-04-01
> **Goal**: Make "AI Triage Analysis" real backend logic, not UI magic

---

## 1. Architecture Overview

### Old Architecture (LLM-First)
```
Inbound Email → Sonnet (classify + draft) → triage_results table
                    ↓
        {category, urgency, risk, summary, action, draft}
                    ↓
            Frontend renders fields
```

**Problem**: `summary`, `recommended_action`, and `draft` are coupled in Sonnet's "mind" — not explicitly structured or auditable.

---

### New Architecture (Strategy-First)
```
┌─────────────────────────────────────────────────────────────┐
│  1. CLASSIFICATION (Sonnet)                                 │
│  • category, urgency, risk, confidence                     │
│  • Raw intent summary (optional)                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. RESPONSE STRATEGY SERVICE (Deterministic First)         │
│  ─────────────────────────────────────────────────────────  │
│  Deterministic Phase:                                       │
│  • Load ticket + customer + email context                  │
│  • Match category → gold_response template (SQL)           │
│  • Determine action_type (rule matrix)                     │
│  • Build drivers (why this strategy)                       │
│  • Build mustInclude/mustAvoid (category rules)            │
│  • Build rationale (human-readable explanation)            │
│                                                            │
│  Haiku Phase (Controlled):                                  │
│  • Generate summary (synthesizes drivers + context)        │
│  • Returns complete strategy object                         │
│                                                            │
│  Persistence:                                               │
│  • Insert into response_strategies table                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. DRAFT GENERATION (Haiku - Strategy-Driven)              │
│  ─────────────────────────────────────────────────────────  │
│  • Receive strategy object + template                       │
│  • Personalise for customer (name, history, LTV)           │
│  • Enforce mustInclude/mustAvoid constraints               │
│  • Apply Sagitone tone rules (deterministic)               │
│  • Generate final draft response                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Frontend renders:
                    - strategy.summary
                    - strategy.recommendedAction
                    - strategy.drivers
                    - strategy.rationale
                    - triage.draftResponse
```

---

## 2. Questions Answered

### Q1: What data sources in the current DB can already drive this?

✅ **Available Now**:
- `gold_responses` — Approved templates per category
- `customer_profiles` — Repeat status, LTV, contact history, flags
- `customer_contact_facts` — Contact ledger for pattern analysis
- `triage_results` — Classification, urgency, risk, confidence
- `inbound_emails` — Original message

✅ **Newly Created**:
- `gold_responses.action_type` — What each template enables operationally
- `gold_responses.mustInclude/mustAvoid` — Content constraints per template
- `gold_responses.appropriateUrgencyMin/Max` — Urgency range compatibility
- `gold_responses.appropriateRiskLevels` — Risk level compatibility

---

### Q2: What additional table/field structure is required?

✅ **Created**:

#### `response_strategies` Table
```sql
CREATE TABLE response_strategies (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  summary TEXT,  -- AI-synthesised or template-derived
  recommended_action TEXT NOT NULL,  -- Human-readable
  action_type TEXT NOT NULL,  -- Canonical action enum
  matched_template_id UUID REFERENCES gold_responses(id),
  matched_template_confidence INTEGER,  -- 0-100
  drivers JSONB,  -- Why this strategy ["High urgency", "Repeat customer"]
  rationale TEXT,  -- Explanation of strategy selection
  draft_tone TEXT DEFAULT 'warm_professional',
  must_include JSONB,  -- Required content elements
  must_avoid JSONB,  -- Prohibited content elements
  customer_context JSONB,  -- Snapshot of customer state
  strategy_source TEXT DEFAULT 'deterministic',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Enhanced `gold_responses` Fields
```sql
ALTER TABLE gold_responses ADD COLUMN action_type TEXT;  -- Response action enum
ALTER TABLE gold_responses ADD COLUMN appropriate_urgency_min INTEGER;
ALTER TABLE gold_responses ADD COLUMN appropriate_urgency_max INTEGER;
ALTER TABLE gold_responses ADD COLUMN appropriate_risk_levels JSONB;  -- ['low', 'medium']
ALTER TABLE gold_responses ADD COLUMN must_include JSONB;  -- ['Photo evidence request']
ALTER TABLE gold_responses ADD COLUMN must_avoid JSONB;  -- ['No apologies', 'No promises']
```

---

### Q3: What should be deterministic vs Haiku-driven?

| Component | Approach | Why |
|-----------|-----------|-----|
| **Category → Template Match** | **Deterministic (SQL)** | Exact category match in DB |
| **Action Type Selection** | **Deterministic (Rules)** | Matrix: category × urgency × risk × repeat |
| **Driver Generation** | **Deterministic** | Flags from customer profile + ticket fields |
| **Rationale Building** | **Deterministic** | Template-based sentence assembly |
| **mustInclude/mustAvoid** | **Deterministic** | Category-based rule tables |
| **Summary** | **Haiku (Controlled)** | Synthesizes drivers into 1-2 sentences |
| **Draft Personalisation** | **Haiku (Controlled)** | Adapts template for customer context |
| **Tone Enforcement** | **Deterministic** | Hardcoded regex replacement rules |

**Key Insight**: Only use Haiku for tasks that require contextual synthesis or personalization. Never use it for deterministic classification or rule application.

---

### Q4: What exact hydration contract should IDE consume?

#### GET /api/hub/ticket/:ticketId Response Shape

```json
{
  "success": true,
  "data": {
    "ticket": { /* existing fields */ },
    "customer": { /* existing fields */ },
    "message": { /* existing fields */ },

    // NEW: Response Strategy Object (Backend-Owned, Not UI Magic)
    "strategy": {
      "summary": "Customer reports damaged product and needs replacement. High urgency due to gift timing.",
      "recommendedAction": "Customer enquiry in damaged_missing_faulty category. REPEAT CUSTOMER + HIGH ATTENTION CUSTOMER. High urgency (8+). Action: arrange_replacement.",
      "actionType": "arrange_replacement",
      "matchedTemplateId": "uuid",
      "matchedTemplateLabel": "Damaged Product - Replacement Request",
      "matchedTemplateConfidence": 95,
      "drivers": [
        "Category: damaged_missing_faulty",
        "High urgency (8+)",
        "Repeat customer",
        "High attention customer",
        "Strong template match"
      ],
      "rationale": "Customer enquiry in damaged_missing_faulty category. REPEAT CUSTOMER + HIGH ATTENTION CUSTOMER. Recommended arrange_replacement based on High urgency (8+), Repeat customer, Strong template match.",
      "draftTone": "warm_professional",
      "mustInclude": [
        "Photo evidence request (if applicable)",
        "Replacement or refund options"
      ],
      "mustAvoid": [
        "No apologies (\"sorry\", \"apologize\")",
        "No promises not in policy"
      ],
      "customerContext": {
        "isRepeatContact": true,
        "isHighAttentionCustomer": true,
        "totalContactCount": 12,
        "thirtyDayVolume": 4,
        "shopifyOrderCount": 3,
        "shopifyLtv": 820.00
      }
    },

    // UPDATED: Now uses strategy.summary if available
    "triage": {
      "aiSummary": "Customer reports damaged product...",  // From strategy.summary
      "recommendedAction": "Arrange replacement...",  // From strategy.recommendedAction
      "draftResponse": "Dear Sarah,\n\nThank you...",  // Generated from strategy
      "wasHumanEdited": false
    },

    "ui": { /* existing visibility flags */ }
  }
}
```

**Field Mapping**:
- `strategy.summary` → Frontend "AI Triage Analysis" panel
- `strategy.recommendedAction` → Frontend "Recommended Action" panel
- `strategy.drivers` → Frontend "Why This Strategy" bullets (NEW UI element)
- `strategy.rationale` → Frontend explanation text (NEW UI element)
- `strategy.mustInclude/mustAvoid` → Frontend proofing reference (NEW UI element)

---

### Q5: Is the current draft generation already linked to a strategy layer?

**No**. Current draft generation happens in Sonnet during classification:
- Sonnet classifies + generates draft in one shot
- No explicit strategy object
- No connection to gold_response templates
- No deterministic constraint enforcement

**Required Refactor**:
1. Split classification (Sonnet) from draft generation (Haiku + strategy)
2. Insert response strategy service between them
3. Update `classifyEmail()` to accept optional `ticketId` parameter
4. Only generate strategy if ticketId exists (backward compatible)

---

## 3. Implementation Status

### ✅ Completed

1. **Response Strategy Service** (`api/services/response-strategy.ts`)
   - `determineActionType()` — Rule matrix for action selection
   - `matchTemplate()` — SQL-based template matching
   - `buildDrivers()` — Explain why this strategy
   - `buildRationale()` — Human-readable explanation
   - `buildConstraints()` — Category-based mustInclude/mustAvoid
   - `generateSummary()` — Haiku synthesis (controlled)
   - `generateResponseStrategy()` — Main orchestrator

2. **Draft Generation Service** (`api/services/draft-generation.ts`)
   - `generateDraftFromStrategy()` — Strategy → Haiku → draft
   - `enforceSagitoneTone()` — Deterministic tone rules
   - `personaliseTemplate()` — Template customization

3. **Schema Updates** (`src/db/schema/gold-responses.ts`)
   - Added `response_strategies` table
   - Enhanced `gold_responses` with action_type, constraints, ranges
   - Added response_action enum

4. **Hub Hydration** (`api/hub.ts`)
   - Added strategy object loading in `getTicketHydration()`
   - Updated payload to include strategy field
   - Frontend can now render real backend-driven analysis

### 🔄 Pending (Requires Classification Workflow Refactor)

5. **Classifier Integration** (`api/services/claude-classifier.ts`)
   - **Current**: Imports added but `classifyEmail()` not yet refactored
   - **Required**: Split classification → strategy → draft pipeline
   - **Breaking**: Need to update classification workflow to pass ticketId

---

## 4. Exact Frontend Contract

### What IDE Should Render

```typescript
interface ResponseStrategy {
  summary: string;              // "Customer reports damaged..."
  recommendedAction: string;    // "Arrange replacement..."
  actionType: string;           // "arrange_replacement"
  matchedTemplateId: string | null;
  matchedTemplateLabel: string | null;  // "Damaged Product - Replacement"
  matchedTemplateConfidence: number;  // 95
  drivers: string[];            // ["High urgency", "Repeat customer"]
  rationale: string;           // Human explanation
  draftTone: string;           // "warm_professional"
  mustInclude: string[];       // ["Photo evidence request"]
  mustAvoid: string[];         // ["No apologies"]
  customerContext: {           // Snapshot
    isRepeatContact: boolean;
    isHighAttentionCustomer: boolean;
    totalContactCount: number;
    thirtyDayVolume: number;
    shopifyOrderCount: number | null;
    shopifyLtv: number | null;
  };
}
```

### UI Components to Render

1. **AI Triage Analysis Panel** (Currently Shows `triage.aiSummary`)
   - **Now**: Render `strategy.summary` (backend-generated, not Sonnet raw)
   - **Why**: More concise, synthesizes strategy + context

2. **Recommended Action Panel** (Currently Shows `triage.recommendedAction`)
   - **Now**: Render `strategy.recommendedAction` (backend-built, not Sonnet raw)
   - **Why**: Grounded in deterministic rules + templates

3. **NEW: "Strategy Drivers" Panel** (Bullets)
   - Render `strategy.drivers` array
   - **Why**: Shows WHY this strategy was selected (transparent)

4. **NEW: "Why This Action" Panel** (Rationale)
   - Render `strategy.rationale` paragraph
   - **Why**: Human-readable explanation of strategy selection

5. **NEW: "Draft Constraints" Panel** (Collapsible)
   - Render `strategy.mustInclude` (green checkmarks)
   - Render `strategy.mustAvoid` (red X marks)
   - **Why**: Shows what draft must include/avoid (proofing reference)

---

## 5. Data Flow Example

### Ticket: Damaged Product from Repeat Customer

**Input**:
```json
{
  "category": "damaged_missing_faulty",
  "urgency": 9,
  "riskLevel": "high",
  "customer": {
    "isRepeatContact": true,
    "isHighAttentionCustomer": true,
    "thirtyDayVolume": 4,
    "shopifyLtv": 820
  }
}
```

**Deterministic Phase** (No LLM):
```sql
-- Match template
SELECT * FROM gold_responses
WHERE category = 'damaged_missing_faulty'
  AND action_type = 'arrange_replacement'
  AND 9 BETWEEN appropriate_urgency_min AND appropriate_urgency_max;
-- Returns: "Damaged Product - Replacement Request" (confidence: 95%)

-- Determine action type
-- damaged_missing_faulty + high urgency = 'arrange_replacement'

-- Build drivers
["Category: damaged_missing_faulty", "High urgency (8+)", "Repeat customer", "High attention customer", "Strong template match"]
```

**Haiku Phase** (Controlled):
```
Input: Strategy object + email context
Output: "Customer reports damaged product and needs replacement. High urgency due to gift timing."
```

**Final Strategy Object**:
```json
{
  "summary": "Customer reports damaged product and needs replacement. High urgency due to gift timing.",
  "recommendedAction": "Arrange replacement and request photo evidence if required.",
  "actionType": "arrange_replacement",
  "matchedTemplateLabel": "Damaged Product - Replacement Request",
  "matchedTemplateConfidence": 95,
  "drivers": ["Category: damaged_missing_faulty", "High urgency (8+)", "Repeat customer", "Strong template match"],
  "rationale": "Customer enquiry in damaged_missing_faulty category. REPEAT CUSTOMER + HIGH ATTENTION CUSTOMER. Recommended arrange_replacement based on High urgency (8+), Repeat customer, Strong template match.",
  "mustInclude": ["Photo evidence request (if applicable)", "Replacement or refund options"],
  "mustAvoid": ["No apologies", "No promises not in policy"]
}
```

**Draft Generation** (from strategy):
```
Input: Strategy + customer context (Sarah, 12 contacts, $820 LTV)
Output: "Dear Sarah,

Thank you for reaching out about your order.

I'm so sorry to hear your item arrived damaged. [REPLACED BY TONE RULES]
→ "Thank you for letting me know about the damage."

To arrange a replacement, could you please:
• Send a photo of the damage
• Confirm your preferred replacement option

Warm regards,
Heidi x"
```

---

## 6. Migration Path

### Phase 1: Database Schema (Ready Now)
```bash
npx drizzle-kit generate  # Creates migration for new tables
npx drizzle-kit push        # Applies to database
```

### Phase 2: Backfill Gold Response Metadata (One-Time Task)
```sql
-- Update existing gold_responses with action types
UPDATE gold_responses
SET action_type = 'arrange_replacement'
WHERE category = 'damaged_missing_faulty';

-- Add mustInclude/mustAvoid for each category
-- (Manual or script-driven)
```

### Phase 3: Classification Workflow Refactor (Breaking Change)
- Update `classifyEmail()` signature to accept `ticketId?`
- Only generate strategy if ticket provided (backward compatible)
- Update inbound email webhook to pass ticketId after ticket creation

### Phase 4: Frontend Integration (Non-Breaking)
- Frontend reads `strategy` field from hydration payload
- Renders new panels (drivers, rationale, constraints)
- Falls back gracefully if `strategy` is null (old tickets)

---

## 7. Acceptance Criteria

### ✅ Deterministic Logic
- [x] Action type determined by rule matrix (not LLM)
- [x] Template matching via SQL (not LLM)
- [x] Drivers built from customer flags (not LLM)
- [x] mustInclude/mustAvoid from category rules (not LLM)

### ✅ Haiku Usage (Controlled)
- [x] Summary synthesis only (not classification)
- [x] Draft personalisation from strategy (not from scratch)
- [x] Never invents policy or promises

### ✅ Audit Trail
- [x] Strategy persisted to `response_strategies` table
- [x] Template ID recorded
- [x] Drivers and rationale recorded
- [x] Constraints recorded

### ✅ Backend-Driven UI
- [x] `strategy.summary` drives "AI Triage Analysis" panel
- [x] `strategy.recommendedAction` drives "Recommended Action" panel
- [x] `strategy.drivers` available for "Why This Strategy" panel
- [x] `strategy.mustInclude/mustAvoid` available for proofing reference

---

## 8. IDE Frontend Changes Required

### Immediate (Non-Breaking)

**Resolution Console Component Updates**:

1. **Load strategy from hydration payload**:
```typescript
const { data } = await fetch(`/api/hub/ticket/${ticketId}`);
const { strategy } = data;

// If strategy exists, use it; otherwise fall back to old fields
const summary = strategy?.summary || triage.aiSummary;
const recommendedAction = strategy?.recommendedAction || triage.recommendedAction;
```

2. **Render "Strategy Drivers" Panel** (NEW):
```typescript
{strategy?.drivers && (
  <StrategyDriversPanel>
    <h4>Why This Strategy</h4>
    <ul>
      {strategy.drivers.map(driver => (
        <li key={driver}>{driver}</li>
      ))}
    </ul>
  </StrategyDriversPanel>
)}
```

3. **Render "Draft Constraints" Panel** (NEW):
```typescript
{strategy?.mustInclude && strategy?.mustAvoid && (
  <DraftConstraintsPanel>
    <h4>Draft Guidelines</h4>
    <div className="must-include">
      <h5>Must Include</h5>
      <ul className="text-green-600">
        {strategy.mustInclude.map(item => (
          <li key={item}>✓ {item}</li>
        ))}
      </ul>
    </div>
    <div className="must-avoid">
      <h5>Must Avoid</h5>
      <ul className="text-red-600">
        {strategy.mustAvoid.map(item => (
          <li key={item}>✗ {item}</li>
        ))}
      </ul>
    </div>
  </DraftConstraintsPanel>
)}
```

4. **Fallback for old tickets**:
```typescript
// Strategy field is null for tickets classified before this feature
if (!strategy) {
  // Hide new panels, use old triage fields
  return (
    <OldTriageDisplay
      summary={triage.aiSummary}
      action={triage.recommendedAction}
    />
  );
}
```

---

## 9. Next Steps

### Immediate (I Can Do Now)

1. **Generate migration** for schema changes
2. **Test response strategy service** with existing tickets
3. **Update one classification endpoint** to use new pipeline
4. **Document example payloads** for frontend testing

### Short-Term (Requires Planning)

1. **Backfill gold_response metadata** (action_type, mustInclude/mustAvoid)
2. **Refactor classifyEmail()** to accept ticketId parameter
3. **Update inbound webhook** flow to support strategy generation
4. **Frontend integration** of new strategy panels

### Long-Term (Future Enhancement)

1. **Template performance tracking** (which templates convert best)
2. **Strategy refinement** (A/B test different rule matrices)
3. **Automated template optimization** based on audit data
4. **Customer feedback loop** (did draft resolve the issue?)

---

## Summary

**Architecture**: ✅ Designed & Services Created
**Schema**: ✅ Tables Defined (Migration Pending)
**Backend Logic**: ✅ Implemented (Deterministic + Haiku)
**Hydration Contract**: ✅ Defined & Ready
**Frontend Integration**: 🔄 Specified (IDE Implementation Pending)

**Ready to proceed with migration and classification workflow refactor.**
