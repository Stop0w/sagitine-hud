Here’s the exact `customer_profile` → UI mapping I’d lock for MVP.

This is designed to minimise ambiguity for the IDE dev and stop frontend/backend drift.

---

# Customer Profile → MVP UI Mapping

## 1. Resolution Console — Left Context Panel

### Customer Identity Block

| UI Element     | Backend Field             | Rule                                                             | MVP Status    |
| -------------- | ------------------------- | ---------------------------------------------------------------- | ------------- |
| Customer Name  | `customer.name`           | Show if present, else fallback to email local-part or “Customer” | Show          |
| Customer Email | `customer.email`          | Always show                                                      | Show          |
| Customer Since | `customer.firstContactAt` | Format as month/year or year only if available                   | Optional show |
| VIP Badge      | none for MVP              | Do not derive unless explicit logic exists                       | Hide          |
| Social Handles | none for MVP              | No fallback text                                                 | Hide          |

### Recommended render logic

```ts id="24108"
displayName =
  customer.name?.trim() ||
  deriveNameFromEmail(customer.email) ||
  "Customer";
```

---

## 2. Account Stats Block

| UI Label        | Backend Field                      | Formatting Rule                                    | MVP Status        |
| --------------- | ---------------------------------- | -------------------------------------------------- | ----------------- |
| Total Contacts  | `customer.totalContactCount`       | Integer                                            | Show              |
| 30-Day Volume   | `customer.thirtyDayVolume`         | Integer, default 0 if derived endpoint supplies it | Show if available |
| Last Contact    | `customer.lastContactAt`           | Format as `DD MMM YY`                              | Show              |
| Repeat Customer | `customer.isRepeatContact`         | Badge or small label                               | Show              |
| High Attention  | `customer.isHighAttentionCustomer` | Badge or alert state                               | Show if true only |
| Current Channel | `customer.lastContactChannel`      | Human label: Email / Phone / etc.                  | Optional show     |

### Recommendation

If space is tight, show only:

* Total Contacts
* 30-Day Volume
* Last Contact

And use badges for:

* Repeat Customer
* High Attention

---

## 3. Shopify Enrichment Block

Only show this if the fields exist.

| UI Element       | Backend Field                | Rule                                                      | MVP Status       |
| ---------------- | ---------------------------- | --------------------------------------------------------- | ---------------- |
| Orders           | `customer.shopifyOrderCount` | Integer                                                   | Show if non-null |
| Lifetime Value   | `customer.shopifyLtv`        | Currency formatted                                        | Show if non-null |
| Shopify Customer | `customer.shopifyCustomerId` | Internal only, do not display unless needed for debugging | Hide             |

### Recommendation

For MVP:

* show `Orders`
* show `Lifetime Value`
* hide raw Shopify IDs

---

## 4. Current Inquiry Context

This block is partly customer-derived and partly ticket-derived.

| UI Element       | Source   | Field                                 | MVP Status |
| ---------------- | -------- | ------------------------------------- | ---------- |
| Current Category | `ticket` | `ticket.categoryLabel` or mapped enum | Show       |
| Confidence       | `ticket` | `ticket.confidence`                   | Show       |
| Urgency          | `ticket` | `ticket.urgency`                      | Show       |
| Risk Level       | `ticket` | `ticket.riskLevel`                    | Show       |

This should not live in `customer_profile`, but it sits visually near it.

---

# Exact backend object for customer section

Use this as the frontend contract:

```json id="84706"
{
  "customer": {
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "firstContactAt": "2022-06-11T00:00:00Z",
    "lastContactAt": "2025-10-14T00:00:00Z",
    "lastContactChannel": "email",
    "totalContactCount": 12,
    "thirtyDayVolume": 4,
    "isRepeatContact": true,
    "isHighAttentionCustomer": true,
    "shopifyOrderCount": 3,
    "shopifyLtv": 820.00
  }
}
```

---

# Field derivation rules

## `name`

Source priority:

1. support-derived profile name
2. Shopify enriched name
3. fallback from email

## `firstContactAt`

Earliest known inbound support contact.

## `lastContactAt`

Latest touchpoint, including successful outbound send if your current logic updates it.

## `lastContactChannel`

Latest known channel, probably `"email"` for MVP.

## `totalContactCount`

Customer-initiated inbound contacts only.

## `thirtyDayVolume`

Count of inbound contact facts in last 30 days.

## `isRepeatContact`

`totalContactCount > 1`

## `isHighAttentionCustomer`

Current agreed rule:

* `lifetime_issue_count >= 3`
  or
* `total_contact_count >= 4`

## `shopifyOrderCount`

Enrichment only, nullable.

## `shopifyLtv`

Enrichment only, nullable.

---

# UI suppression rules for customer_profile

## Remove entirely for MVP

Do not render these at all:

* Instagram handle
* Facebook / social links
* VIP badge
* Interaction timeline
* manual notes
* phone unless there is a clear reason to display it

## Do not show placeholder text like:

* N/A
* Coming soon
* Unknown

If data is absent, the component should collapse.

---

# Exact UI rendering logic

## Identity section

Show:

* Name
* Email

Optional:

* “Customer since 2022” if `firstContactAt` exists

## Stats section

Show rows only if present:

* Total Contacts
* 30-Day Volume
* Last Contact
* Orders
* Lifetime Value

## Badges

Show conditionally:

* Repeat Customer
* High Attention

---

# Recommended MVP layout

## Left panel order

1. Name
2. Email
3. Badge row

   * Repeat Customer
   * High Attention
4. Stats

   * Total Contacts
   * 30-Day Volume
   * Last Contact
   * Orders
   * Lifetime Value
5. Open in Outlook CTA

That’s enough. Anything more is noise for MVP.

---

# Exact mapping table for the IDE dev

```text id="31062"
customer.name                -> Header: Customer Name
customer.email               -> Subheader: Customer Email
customer.firstContactAt      -> Optional label: Customer since [year]
customer.totalContactCount   -> Account Stats: Total Contacts
customer.thirtyDayVolume     -> Account Stats: 30-Day Volume
customer.lastContactAt       -> Account Stats: Last Contact
customer.isRepeatContact     -> Badge: Repeat Customer
customer.isHighAttentionCustomer -> Badge: High Attention
customer.lastContactChannel  -> Optional small label if space allows
customer.shopifyOrderCount   -> Account Stats: Orders
customer.shopifyLtv          -> Account Stats: Lifetime Value
```

---

# One important design recommendation

Do not make `customer_profile` carry visual future-state meaning it does not yet earn.

For example:

* “VIP” sounds authoritative but is not yet grounded
* “social presence” implies cross-channel identity you don’t yet have

For MVP, the customer context should answer only:

> Who is this customer, how often have they contacted us, how recently, and are they potentially high attention?

That is the right service lens.

---

# Suggested note to send the IDE dev

```text id="35741"
Please map customer_profile into the MVP UI using only grounded service-context fields.

Render:
- name
- email
- firstContactAt (optional: Customer since)
- totalContactCount
- thirtyDayVolume
- lastContactAt
- isRepeatContact
- isHighAttentionCustomer
- shopifyOrderCount (if present)
- shopifyLtv (if present)

Hide entirely for MVP:
- VIP badge
- social handles
- interaction timeline
- placeholders like N/A or Coming soon

If an optional field is absent, collapse the UI element rather than rendering an empty state.
```

Here’s the combined MVP hydration payload I’d lock for:

```text
GET /api/hub/ticket/:ticketId
```

This is designed to:

* match the current backend architecture
* support the MVP UI cleanly
* keep Shopify enrichment optional and static-friendly
* avoid future-state bloat

---

# Combined payload

```json id="92314"
{
  "ticket": {
    "id": "tkt_123",
    "status": "classified",
    "sendStatus": "not_applicable",
    "receivedAt": "2026-04-01T10:15:00Z",
    "category": "damaged_missing_faulty",
    "categoryLabel": "Damaged & Faulty",
    "confidence": 0.94,
    "urgency": 9,
    "riskLevel": "high",
    "customerIntentSummary": "Customer reports visibly damaged product and requests replacement or refund.",
    "recommendedNextAction": "Arrange replacement and request photo evidence if required."
  },
  "customer": {
    "id": "cust_456",
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "firstContactAt": "2022-06-11T00:00:00Z",
    "lastContactAt": "2025-10-14T00:00:00Z",
    "lastContactChannel": "email",
    "totalContactCount": 12,
    "thirtyDayVolume": 4,
    "isRepeatContact": true,
    "isHighAttentionCustomer": true,
    "shopifyOrderCount": 3,
    "shopifyLtv": 820.00
  },
  "message": {
    "subject": "Damaged product received",
    "fullMessage": "Hi team,\n\nI received my order yesterday (Order #12345) and unfortunately the product arrived with visible cracks on the surface...\n\nThank you,\nSarah Johnson",
    "preview": "I received my order yesterday and unfortunately the product arrived with visible cracks..."
  },
  "triage": {
    "aiSummary": "Customer reports severely damaged product that doesn't function and needs replacement/refund. High urgency due to gift timing and product failure.",
    "draftResponse": "Dear Sarah,\n\nThank you for reaching out regarding your damaged order...\n\nWarm regards,\nHeidi x",
    "wasHumanEdited": false
  },
  "ui": {
    "showCustomerSince": true,
    "showThirtyDayVolume": true,
    "showRepeatBadge": true,
    "showHighAttentionBadge": true,
    "showShopifyOrderCount": true,
    "showShopifyLtv": true,
    "showSocialHandles": false,
    "showVipBadge": false,
    "showInteractionTimeline": false,
    "canEditDraft": true,
    "canSend": true
  }
}
```

---

# Field-by-field intent

## `ticket`

This is the operational state and current enquiry context.

### Required

* `id`
* `status`
* `sendStatus`
* `receivedAt`
* `category`
* `categoryLabel`
* `confidence`
* `urgency`
* `riskLevel`
* `customerIntentSummary`
* `recommendedNextAction`

---

## `customer`

This is the lightweight CRM summary.

### Required for MVP

* `id`
* `name`
* `email`
* `firstContactAt`
* `lastContactAt`
* `lastContactChannel`
* `totalContactCount`
* `thirtyDayVolume`
* `isRepeatContact`
* `isHighAttentionCustomer`

### Optional enrichment

* `shopifyOrderCount`
* `shopifyLtv`

### Not included

* social handles
* phone
* VIP
* tags
* notes
* timeline payload

---

## `message`

This is the original inbound message.

### Required

* `subject`
* `fullMessage`

### Optional but recommended

* `preview`

---

## `triage`

This is the AI-generated interpretation and draft.

### Required

* `aiSummary`
* `draftResponse`

### Recommended

* `wasHumanEdited`

---

## `ui`

This is a backend-driven visibility contract so the MVP UI can suppress unsupported future-state elements without branching all over the frontend.

You can keep this lean, but it is very useful.

---

# Shopify-specific note

Because Shopify enrichment is relatively static and you’re happy to refresh it every 3 months:

## Recommendation

Treat Shopify values as:

* nullable
* enrichment-only
* not required for endpoint success

So if enrichment has not been run recently, this payload should still work perfectly with:

* `shopifyOrderCount: null`
* `shopifyLtv: null`

The UI should simply collapse those rows.

That means the endpoint stays stable even when Shopify data lags.

---

# Backend derivation rules

## `categoryLabel`

Derived from enum mapping, not stored.

## `thirtyDayVolume`

Derived from `customer_contact_facts` over the last 30 days.

## `wasHumanEdited`

Derived from ticket/draft state.

## `ui.*`

Can be hardcoded server-side for MVP or omitted if the frontend owns suppression.
I slightly prefer including them for version control of behaviour.

---

# Null handling rules

Use these rules:

* `customer.name` → fallback from email if null
* `firstContactAt` → nullable
* `lastContactAt` → nullable
* `shopifyOrderCount` → nullable
* `shopifyLtv` → nullable

Do **not** send placeholder strings like:

* `"N/A"`
* `"Coming soon"`

Use `null` and let UI collapse.

---

# Recommended TypeScript shape

```ts id="51822"
type HubTicketHydration = {
  ticket: {
    id: string;
    status: string;
    sendStatus: string;
    receivedAt: string;
    category: string;
    categoryLabel: string;
    confidence: number;
    urgency: number;
    riskLevel: "low" | "medium" | "high";
    customerIntentSummary: string | null;
    recommendedNextAction: string | null;
  };
  customer: {
    id: string;
    name: string | null;
    email: string;
    firstContactAt: string | null;
    lastContactAt: string | null;
    lastContactChannel: string | null;
    totalContactCount: number;
    thirtyDayVolume: number;
    isRepeatContact: boolean;
    isHighAttentionCustomer: boolean;
    shopifyOrderCount: number | null;
    shopifyLtv: number | null;
  };
  message: {
    subject: string;
    fullMessage: string;
    preview: string | null;
  };
  triage: {
    aiSummary: string | null;
    draftResponse: string | null;
    wasHumanEdited: boolean;
  };
  ui: {
    showCustomerSince: boolean;
    showThirtyDayVolume: boolean;
    showRepeatBadge: boolean;
    showHighAttentionBadge: boolean;
    showShopifyOrderCount: boolean;
    showShopifyLtv: boolean;
    showSocialHandles: boolean;
    showVipBadge: boolean;
    showInteractionTimeline: boolean;
    canEditDraft: boolean;
    canSend: boolean;
  };
};
```

---

# Short version to send the IDE dev

```text id="68784"
Please use the combined MVP hydration contract for GET /api/hub/ticket/:ticketId with 5 top-level objects:

- ticket
- customer
- message
- triage
- ui

Customer should include only grounded lightweight CRM fields:
- name
- email
- firstContactAt
- lastContactAt
- lastContactChannel
- totalContactCount
- thirtyDayVolume
- isRepeatContact
- isHighAttentionCustomer
- shopifyOrderCount (nullable)
- shopifyLtv (nullable)

Shopify enrichment is static and refreshed periodically, so these fields must remain optional and must not break endpoint hydration if null.

Do not include future-state fields like social handles, VIP, or interaction timeline in the MVP payload.
```


