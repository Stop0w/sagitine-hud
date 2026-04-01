# Hub API Contract - MVP Backend Specification

> **Status**: Production-ready for MVP UI integration
> **Version**: 1.0
> **Last Updated**: 2026-04-01

---

## Overview

The Hub API provides progressive hydration for the Notification HUD + Resolution Console UI using a 4-layer model designed to minimize wire transfer while providing complete operational context.

**Architecture Principle**: The backend defines data truth. The UI progressively hydrates only what exists. No placeholders, no future-state assumptions.

---

## HUD Visibility Logic (TICKET LIFECYCLE)

### Tickets Are EXCLUDED from HUD When:

Tickets disappear from all HUD views (metrics, categories, queue) when they meet **ANY** of:

1. **status = 'archived'** (manually archived or auto-archived after send)
2. **status = 'rejected'** (manually rejected)
3. **sendStatus = 'sent'** (successfully sent/resolved)

### Tickets ARE INCLUDED in HUD When:

1. **status IN ('new', 'classified', 'approved')**
2. **AND sendStatus NOT IN ('sent')**

### SQL Filter (Applied Consistently)

```sql
WHERE (
  tickets.status NOT IN ('archived', 'rejected')
  AND tickets.send_status != 'sent'
)
```

### Lifecycle States

**New Ticket**:
```
inbound_email received → classify → create ticket (status='new')
→ Show in HUD ✓
```

**Normal Flow**:
```
ticket classified → approved → Make sends → sendStatus='sent'
→ Remove from HUD ✓
```

**Manual Handling**:
```
agent handles in Outlook → POST /api/hub/ticket/:id/resolve
→ status='archived'
→ Remove from HUD ✓
```

**Rejected**:
```
ticket rejected → status='rejected'
→ Remove from HUD ✓
```

**Spam**:
```
categorized as 'spam_solicitation' → Still visible until resolved
→ POST /api/hub/ticket/:id/resolve
→ Remove from HUD ✓
```

### Note: No 'resolved' Status

There is no 'resolved' status in the ticket enum. Successfully sent tickets (`sendStatus='sent'`) are considered resolved and are automatically excluded from HUD.

---

## Criticality Threshold Logic (LOCKED)

The `criticality` field in `/api/hub/metrics` uses this exact calculation:

### Formula

```typescript
urgentRatio = urgentCount / totalOpen

if (urgentRatio > 0.3) {
  criticality = "CRITICAL"
} else if (urgentRatio > 0.15) {
  criticality = "ELEVATED"
} else {
  criticality = "NOMINAL"
}
```

### Definition of "Urgent"

A ticket is considered urgent if it meets ALL of:
1. `status NOT IN ('sent', 'archived')`
2. AND (`urgency >= 7` OR `risk_level = 'high'`)

### Threshold Rationale

- **30% urgent**: Critical mass of high-priority work, requires immediate attention
- **15% urgent**: Elevated tension, team should monitor closely
- **≤15% urgent**: Normal operational state, business as usual

**Implementation Note**: This logic must remain consistent across:
- Backend Hub API
- Frontend HUD display
- Future analytics dashboards
- Alerting thresholds

---

## Category System (13 Canonical Categories)

### Enum Values (Backend Truth)

The backend always returns these exact enum values:

```typescript
'damaged_missing_faulty'
'shipping_delivery_order_issue'
'product_usage_guidance'
'pre_purchase_question'
'return_refund_exchange'
'stock_availability'
'partnership_wholesale_press'
'brand_feedback_general'
'spam_solicitation'
'other_uncategorized'
'account_billing_payment'
'order_modification_cancellation'
'praise_testimonial_ugc'
```

### Display Labels (Human Readable)

The backend maps enums to display labels:

```typescript
{
  damaged_missing_faulty: 'Damaged & Faulty',
  shipping_delivery_order_issue: 'Shipping & Delivery',
  product_usage_guidance: 'Product Usage',
  pre_purchase_question: 'Pre-Purchase',
  return_refund_exchange: 'Return & Refund',
  stock_availability: 'Stock Availability',
  partnership_wholesale_press: 'Partnership & Press',
  brand_feedback_general: 'Brand Feedback',
  spam_solicitation: 'Spam & Solicitation',
  other_uncategorized: 'Other',
  account_billing_payment: 'Account & Billing',
  order_modification_cancellation: 'Order Modification',
  praise_testimonial_ugc: 'Praise & Feedback'
}
```

### Contract Rule

**Backend**: Always return canonical enum values in `category` field
**Frontend**: May group visually for display, but never loses raw enum fidelity
**Example**: Frontend may group "Account & Billing" + "Order Modification" into "Account Issues" visually, but backend always returns the original 13-category enum.

---

## Queue Sorting Logic (Operational Priority Model)

The `GET /api/hub/queue/:category` endpoint uses this sorting priority:

### Primary: Urgency (DESC)
Highest urgency first (urgency 10 → 0)

### Secondary: Risk Level (ordinal)
High > Medium > Low (using CASE mapping: high=1, medium=2, low=3)

### Tertiary: Received Date (ASC)
Oldest tickets first within equal urgency+risk groups (FCFS - First Come First Served)

### SQL Implementation

```sql
ORDER BY urgency DESC,
         CASE risk_level
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         received_at ASC
```

### Operational Rationale

This serves the real CX workflow:
1. **Urgency**: Most critical customer issues first
2. **Risk**: High-risk items (escalations, refunds) within urgency bands
3. **FCFS**: Fairness within equal priority tiers

---

## Field Naming Standardization

### Unified Naming Convention

All endpoints now use consistent field names:

**Before** (inconsistent):
```json
{
  "ticket_id": "...",
  "categoryPrimary": "damaged_missing_faulty"
}
```

**After** (standardized):
```json
{
  "id": "...",
  "category": "damaged_missing_faulty"
}
```

### Queue Endpoint Fields

```typescript
{
  id: string,              // was ticket_id
  status: string,
  sendStatus: string,
  fromEmail: string,
  fromName: string,
  subject: string,
  category: string,        // was categoryPrimary
  categoryLabel: string,   // NEW: human-readable label
  confidence: number,
  urgency: number,
  riskLevel: string,
  receivedAt: string,
  createdAt: string,
  preview: string          // NEW: 150-char preview
}
```

### Ticket Hydration Endpoint Fields

```typescript
{
  ticket: {
    id: string,
    status: string,
    sendStatus: string,
    receivedAt: string,
    category: string,
    categoryLabel: string,
    confidence: number,
    urgency: number,
    riskLevel: string,
    customerIntentSummary: string,
    recommendedNextAction: string
  },
  customer: { ... },
  message: { ... },
  triage: { ... },
  ui: { ... }
}
```

---

## Categories Endpoint Behavior (LOCKED)

### Contract: Return All 13 Categories Always

The `GET /api/hub/categories` endpoint:

1. **Always returns all 13 categories** (including zero-count rows)
2. **Zero-count categories** have:
   - `count: 0`
   - `urgency: 'low'` (default)
   - `avgConfidence: 0`
3. **Active categories** have real aggregated values

### Why All 13 Categories?

**Contract Stability**: Frontend can rely on consistent category structure even when some categories have no tickets currently.

**UI Behavior**: Frontend may visually suppress zero-count categories, but the backend contract remains stable.

**Example Response**:
```json
{
  "success": true,
  "data": [
    {
      "category": "damaged_missing_faulty",
      "categoryLabel": "Damaged & Faulty",
      "count": 8,
      "urgency": "high",
      "avgConfidence": 0.92
    },
    {
      "category": "stock_availability",
      "categoryLabel": "Stock Availability",
      "count": 0,
      "urgency": "low",
      "avgConfidence": 0
    },
    // ... all 13 categories
  ]
}
```

---

## thirtyDayVolume Calculation (ON-DEMAND)

### Definition

`thirtyDayVolume` = Count of inbound customer_contact_facts for a customer in the last 30 days

### SQL Implementation

```sql
SELECT COUNT(*)
FROM customer_contact_facts
WHERE customer_profile_id = ?
  AND direction = 'inbound'    -- Customer-initiated only
  AND contact_at >= NOW() - INTERVAL 30 days
```

### Rules

- **Calculated on-demand**: No caching, computed per-request
- **Inbound only**: Do NOT include outbound replies
- **Rolling window**: Always last 30 days from current timestamp
- **Zero default**: Returns 0 if no facts in window (not null)

### Usage

This field helps identify:
- High-volume customers (may need proactive support)
- Recent engagement spikes (may indicate unresolved issues)
- Contact patterns (churn risk assessment)

---

## UI Visibility Object (Backend-Driven Suppression)

### Purpose

The `ui` object in the ticket hydration payload allows the backend to control which UI elements are shown/hidden for MVP. This prevents frontend branching and keeps suppression logic centralized.

### MVP Contract

```typescript
{
  ui: {
    // Show/hide customer fields
    showCustomerSince: boolean,        // true if firstContactAt exists
    showThirtyDayVolume: boolean,       // always true for MVP
    showRepeatBadge: boolean,          // true if isRepeatContact
    showHighAttentionBadge: boolean,   // true if isHighAttentionCustomer
    showShopifyOrderCount: boolean,    // true if shopifyOrderCount != null
    showShopifyLtv: boolean,           // true if shopifyLtv != null

    // Future-state suppression (hardcoded false for MVP)
    showSocialHandles: false,          // REMOVE from MVP
    showVipBadge: false,               // REMOVE from MVP
    showInteractionTimeline: false,    // REMOVE from MVP

    // Action controls
    canEditDraft: boolean,             // true for MVP
    canSend: boolean,                  // true if ticket operationally sendable (not sent/failed)
    requiresProof: boolean              // true for MVP (simplified proof workflow)
  }
}
```

### Field Definitions

**`canSend`**: Indicates whether the ticket is in an operational state where sending is possible (not already sent/failed). This is **not** the same as the SEND button being enabled - the frontend's proof/edit state machine controls actual button visibility. `canSend` is a precondition check.

**Example**:
- A ticket with `status: 'classified'` → `canSend: true` (operationally ready to send)
- A ticket with `status: 'sent'` → `canSend: false` (already sent)
- A ticket with `status: 'failed'` → `canSend: false` (send failed, may need retry)

**Frontend behavior**:
- If `canSend: false`: Hide SEND button entirely
- If `canSend: true`: Show SEND button, but enable/disable based on proof state machine

### Rule

**Frontend must obey**: The frontend should NOT independently decide visibility. The `ui` object is the single source of truth for what to show/hide.

**Backend changes**: When future-state features are implemented, backend updates `ui` flags to `true` and frontend automatically reveals them without code changes.

---

## Proof Workflow (Simplified MVP)

### State Machine

```
Initial State:     [EDIT] [PROOF]
     ↓
PROOF clicked:     POST /api/hub/proof → [SEND]
     ↓
EDIT clicked:       [EDIT] [PROOF]  ← Send state revoked
     ↓
Draft changed:      [EDIT] [PROOF]  ← Force reset
     ↓
SEND clicked:       Trigger approve → Make webhook
```

### Backend Endpoint: POST /api/hub/proof

**Purpose**: Real-time draft safety check before allowing send

**Request**:
```json
{
  "ticketId": "uuid",
  "draftResponse": "string (current draft content)"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "isSafeToSend": true,
    "issues": [],
    "warnings": []
  }
}
```

**MVP Simplified Behavior**:
- Always returns `isSafeToSend: true` for MVP
- `issues` and `warnings` arrays empty (future-state feature)
- Frontend treats this as "proof passed" and enables SEND button

### Safeguard Logic

1. **PROOF button**: Calls `POST /api/hub/proof`, enables SEND if `isSafeToSend: true`
2. **EDIT button**: Makes draft editable
3. **onChange trap**: If draft is edited after proof, SEND button revokes back to PROOF
4. **SEND**: Only available when proof has succeeded AND draft hasn't been edited since

### UI Simplification (MVP)

- Proof suggestions panel can be suppressed or simplified for MVP
- No need for full verbose future-state suggestions UI
- But the proof ACTION itself remains a real backend call, not local state

### Future-State Path

When full proof ML pipeline is ready:
- Backend adds real analysis to `/api/hub/proof`
- Returns `issues` array with tone/grammar/safety suggestions
- Frontend displays suggestions beneath draft
- Dismiss logic remains the same (confirms visual review)

---

## Send Architecture (Make Orchestrator)

### Current Workflow (LOCKED)

```
1. Frontend: Click SEND
2. Backend: POST /api/tickets/:id/approve
3. Backend: Set status='approved', sendStatus='pending'
4. Backend: Trigger Make.com webhook
5. Make: Send via Outlook
6. Make: Callback POST /api/tickets/:id/sent OR /failed
7. Backend: Update sendStatus, record outbound contact fact
```

### Rule

**DO NOT** implement direct-send in backend app server.

**Why**: Make.com is the proven orchestrator with retry logic, error handling, and Outlook integration. Moving this to backend would add complexity and risk.

**Frontend Action**: The "SEND" button should call the existing approve endpoint, not a new resolve endpoint.

---

## Manual Resolution Endpoint (MVP-Safe)

### POST /api/hub/ticket/:id/resolve

**Purpose**: Mark tickets as resolved when handled manually outside the system (e.g., in Outlook)

**Use Case**: Agent handles enquiry directly in Outlook, needs to remove it from HUD without going through the full AI draft + approve flow

**Request**:
```json
{
  "resolved_by": "Heidi",           // Optional, defaults to 'Heidi'
  "resolution_reason": "Handled manually in Outlook"  // Optional
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "ticket-uuid",
    "status": "archived",
    "archivedAt": "2026-04-01T10:30:00.000Z",
    "message": "Ticket marked as resolved and removed from HUD"
  },
  "timestamp": "2026-04-01T10:30:00.000Z"
}
```

**Effect**:
- Sets `status = 'archived'`
- Sets `archivedAt = NOW()`
- Stores `resolutionReason` for audit trail
- **Ticket immediately disappears from all HUD views**

**Why This is MVP-Safe**:
- No changes to send workflow
- No auto-email triggers
- Simply removes from operational queue
- Audit trail maintained in `rejectionReason` field

**UI Integration**: Add "Mark Resolved" or "Handled in Outlook" button to Resolution Console for tickets handled outside the system.

---

## Shopify Enrichment (Optional Fields)

### MVP Rule

Shopify fields are **enrichment-only** and **must be nullable**:

```typescript
{
  customer: {
    shopifyOrderCount: number | null,  // null if not enriched yet
    shopifyLtv: number | null         // null if not enriched yet
  }
}
```

### UI Behavior

- If `shopifyOrderCount === null`: Collapse "Orders" row
- If `shopifyLtv === null`: Collapse "Lifetime Value" row
- Do NOT show "N/A" or placeholders

### Backend Resilience

The endpoint must work perfectly even when Shopify enrichment has not been run recently. These fields are **optional** and must not break hydration.

---

## Error Handling Standard

### All Endpoints

```json
{
  "success": false,
  "error": "Human-readable error message",
  "timestamp": "2026-04-01T10:30:00.000Z"
}
```

### HTTP Status Codes

- `200`: Success
- `400`: Bad request (missing required parameter)
- `404`: Resource not found (ticket ID doesn't exist)
- `500`: Server error (unexpected backend error)

---

## CORS Configuration

### MVP Configuration

All endpoints include permissive CORS headers:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

OPTIONS requests return `200 OK` immediately.

### Future Consideration

**Note**: Permissive CORS (`*`) is acceptable for MVP but may be tightened in production to specific domains based on deployment environment.

**Examples of future tightening**:
```http
Access-Control-Allow-Origin: https://sagitine-dashboard.example.com
Access-Control-Allow-Origin: https://app.sagitine.com
```

This change would be made in the backend handler when moving to production deployment.

---

## Sample Response Payloads (VALIDATED)

See separate documentation for exact response shapes from each endpoint.

---

## Future-State Migration Path

When MVP features are ready to graduate to full system:

1. **Backend**: Update `ui` visibility flags from `false` → `true`
2. **Frontend**: UI automatically reveals features (no code changes needed)
3. **Data**: Add new fields to payloads as they become real
4. **Validation**: Update this contract document

This ensures zero rework and clean iteration from MVP to future-state.

---

## Contact & Support

**Backend Owner**: Sagitine AI CX Agent Team
**API Version**: 1.0
**Last Updated**: 2026-04-01
**Status**: Production-ready for MVP UI integration
