# Addendum: MVP UI Layer & Backend Alignment Strategy

## Context

The current **Notification Hub + Resolution Console UI** represents the correct **future-state architecture** and should be preserved in full.

However, the backend system currently being implemented (tickets, triage, lightweight CRM, Make-driven send workflow) does **not yet support all UI elements shown**.

To avoid:

* unnecessary backend scope expansion
* brittle or mocked data contracts
* repeated rework cycles

we will introduce a **dual-layer UI strategy**:

1. Preserve the **future-state UI (unchanged)**
2. Introduce a **clean MVP UI layer** aligned to current backend capabilities

---

## Core Principle

> The UI must not force backend scope expansion.
> The backend must define what is real.
> The UI must progressively reveal only what is supported.

---

# 1. Dual UI Architecture (MANDATORY)

## 1.1 Future-State UI (Existing)

* Keep **all existing UI components unchanged**
* Do not delete, refactor, or simplify
* This remains the **target state**

### Naming

* `/ui/future/` OR feature-flagged as `futureMode = true`

---

## 1.2 MVP UI Layer (New)

Create a **parallel MVP UI implementation** that:

* Uses the same layout and structure
* Removes unsupported data dependencies
* Hydrates only from existing backend endpoints

### Naming

* `/ui/mvp/` OR feature-flagged as `mvpMode = true`

---

## 1.3 Switching Mechanism

Implement one of:

### Option A (Preferred)

Feature flag:

```ts
const UI_MODE = "mvp" | "future"
```

### Option B

Environment-based:

```env
NEXT_PUBLIC_UI_MODE=mvp
```

---

# 2. MVP UI Suppression Rules (CRITICAL)

The MVP UI must **remove or hide**, not degrade, unsupported elements.

## REMOVE entirely (do not show placeholders)

* Social handles (Instagram, etc.)
* VIP badge (unless explicitly derived)
* Interaction timeline (if not backed by real data)
* Proofing suggestions panel (`/api/hub/proof`)
* Any fields requiring non-existent enrichment

## DO NOT SHOW

* "N/A"
* "Coming soon"
* empty UI shells

---

# 3. MVP Data Contract (SOURCE OF TRUTH)

The backend must support a **single unified hydration object** for the Resolution Console.

### Endpoint

```
GET /api/hub/ticket/:ticketId
```

### Required Shape

```json
{
  "ticket": {
    "id": "uuid",
    "status": "review_required",
    "receivedAt": "timestamp",
    "category": "enum",
    "confidence": 0.94,
    "urgency": 9,
    "riskLevel": "high"
  },
  "customer": {
    "name": "string",
    "email": "string",
    "firstContactAt": "timestamp|null",
    "lastContactAt": "timestamp|null",
    "totalContactCount": 12,
    "thirtyDayVolume": 4,
    "isRepeatContact": true,
    "isHighAttentionCustomer": true,
    "shopifyOrderCount": number|null,
    "shopifyLtv": number|null
  },
  "triage": {
    "aiSummary": "string",
    "recommendedAction": "string",
    "draftResponse": "string"
  },
  "message": {
    "subject": "string",
    "fullMessage": "string"
  }
}
```

---

# 4. Category System Alignment (CRITICAL)

The backend MUST use the **13-category canonical schema**.

The UI MAY:

* group categories visually
* map labels for display

BUT:

* backend responses must always use canonical enum values

---

# 5. Progressive Hydration Model (KEEP)

Maintain the progressive loading architecture:

### Phase 1

```
GET /api/hub/metrics
```

### Phase 2

```
GET /api/hub/categories
```

### Phase 3

```
GET /api/hub/queue/:category
```

### Phase 4

```
GET /api/hub/ticket/:ticketId
```

---

# 6. Resolution Workflow (ALIGN WITH EXISTING BACKEND)

## DO NOT implement:

```
POST /api/hub/resolve/:ticketId
```

that directly sends emails.

## INSTEAD:

Follow existing architecture:

1. UI triggers "Send"
2. Backend marks ticket as approved
3. Backend triggers Make webhook
4. Make sends email via Outlook
5. Make calls:

   * `/api/tickets/:id/sent`
   * `/api/tickets/:id/failed`

---

# 7. Draft Editing (MVP SIMPLIFICATION)

## Current (Future-State)

* Proof → Edit → Re-proof → Send logic

## MVP Implementation

* Allow:

  * Edit
  * Send

### Add metadata:

```json
{
  "wasEdited": true | false
}
```

No proofing endpoint required for MVP.

---

# 8. Backend Constraints

## Must NOT:

* fabricate data for UI completeness
* introduce placeholder values
* expand schema solely for UI alignment

## Must:

* return only real, persisted data
* use null-safe optional fields
* ensure idempotent endpoints

---

# 9. Success Criteria

MVP is considered correct when:

* UI renders cleanly with **no placeholders**
* All displayed data is real and sourced
* Resolution flow works end-to-end:

  * triage → draft → approve → send → callback
* No backend work is created solely for UI parity

---

# 10. Future-State Preservation

All removed/suppressed components must:

* remain implemented
* remain version-controlled
* be easily re-enabled

This ensures:

* zero loss of design work
* fast iteration toward full system maturity

---

## Final Instruction

Build the MVP UI as a **strict, minimal, production-safe layer**
on top of the existing backend.

Do not compromise:

* backend integrity
* data accuracy
* system simplicity

The future-state UI remains the north star —
but the MVP must reflect reality.
