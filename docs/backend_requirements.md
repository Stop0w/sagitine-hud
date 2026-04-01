# Sagitine CX Notification Hub - Backend Implementation Guide

> [!NOTE] 
> This document outlines the exact data contracts, hydration strategies, and UX safeguards required to power the newly re-engineered Notification Hub and Resolution Console. It is intended as a strict specification for backend engineers implementing the API endpoints.

---

## Technical Approach & Hydration
Do **not** perform a monolithic data load on application initialize. The UI heavily relies on **progressive hydration** tied accurately to the user's progressive disclosure clicks.

### Phase 1: Progressive Disclosure (The Queue HUD)

![Progressive Disclosure Notification Bar](C:/Users/hayde/.gemini/antigravity/brain/f4c6f35c-473d-41e2-a6bd-8c8e9e667246/1_progressive_disclosure.png)

This is the system's baseline resting state. It polls for asynchronous operational anomalies.

**Backend Requirements (`GET /api/hub/metrics`):**
- **Trigger**: Polling (e.g., every 30-60 secs) or WebSockets.
- **Payload**: Minimal JSON payload indicating top-level state.
- **Data Points**:
  - `totalOpen`: Integer mapping to total unresolved tickets.
  - `urgentCount`: Integer of SLA-breached or Priority 1 tickets.
  - `avgResponseTimeMinutes`: Global queue metric.
  - `criticality`: System tension metric (`NOMINAL`, `ELEVATED`, `CRITICAL`).

---

### Phase 2: Hub Overview (The Triaged Categorization)

![Hub Overview](C:/Users/hayde/.gemini/antigravity/brain/f4c6f35c-473d-41e2-a6bd-8c8e9e667246/2_hub_overview.png)

When expanded, the HUD maps queue tension strictly against predefined taxonomy arrays.

**Backend Requirements (`GET /api/hub/categories`):**
- **Trigger**: Expanding the bottom-right HUD pill.
- **Categories**: Must adhere strictly to the 10 defined Postgres Enums.
- **Enums**: `damaged_missing_faulty`, `shipping_delivery_order_issue`, `product_usage_guidance`, `pre_purchase_question`, `return_refund_exchange`, `stock_availability`, `partnership_wholesale_press`, `brand_feedback_general`, `spam_solicitation`, `other_uncategorized`.
- **Payload Data Points**: For each category, return:
  - `count` (Total tickets inside)
  - `urgency` (`low`, `medium`, `high`)
  - `avgConfidence` (Mean AI confidence score for routing).

---

### Phase 3: Ticket Queue (Category Drill-down)

![Ticket Queue](C:/Users/hayde/.gemini/antigravity/brain/f4c6f35c-473d-41e2-a6bd-8c8e9e667246/3_ticket_queue.png)

Double-clicking a category lists the raw, chronological ticket queues ranked organically by urgency and wait-time.

**Backend Requirements (`GET /api/hub/queue/:categoryId`):**
- **Trigger**: Selecting a specific category row from Phase 2.
- **Payload Elements**:
  - Requires ticket `id`, `receivedAt`, `confidence` score (0.00-1.00), and `status` (`new`, `triaged`, `review_required`, `drafted`).
  - Snippet text (`preview`) capped at ~150 characters to reduce wire transfer size.
  - `riskLevel`: Evaluated based on customer tone or refund amount (`low`, `medium`, `high`).

---

### Phase 4: The Resolution Console

The Resolution Console is a single-page application within the HUD acting as the terminal for agent actions. It is highly stateful.

![Resolution Console Collapsed](C:/Users/hayde/.gemini/antigravity/brain/f4c6f35c-473d-41e2-a6bd-8c8e9e667246/4a_resolution_console_collapsed.png)

<!-- slide -->

![Resolution Console Expanded](C:/Users/hayde/.gemini/antigravity/brain/f4c6f35c-473d-41e2-a6bd-8c8e9e667246/4b_resolution_console_expanded.png)

#### 4.1 Data Requirements (`GET /api/hub/ticket/:ticketId`)
When an agent clicks an inquiry, fetch the exhaustive ticket hydration object:
- **Core Info**: `fullMessage`, `subject`, `customerEmail`.
- **CRM Join Data**: `customerTier` (Standard/VIP), `thirtyDayVol`, `lastContactDate`. This means the backend must silently query the CRM and synthesize this payload before returning it to the frontend.
- **AI Outputs**: `aiSummary`, `draftResponse` (with pre-built `\n\n` paragraph breaks), and `recommendedAction`.
- **Expanded Mode Data**: Additional timelines/history payload ONLY requested/passed if available.

#### 4.2 The "Proofing Workflow" Safeguard (CRITICAL LOGIC)

The button state management beneath the Draft editor implements a vital "Fail-safe" architecture to prevent agents from sending unverified, manual edits. **The backend endpoint must be prepared to accept both the original AI text OR the Agent's manually manipulated string.**

> [!WARNING]
> **The UI State Timeline operates like so:**
> 1. Initial State: Editor is read-only. Button block shows `EDIT` and `PROOF`.
> 2. `PROOF` Clicked: UI triggers `POST /api/hub/proof` providing `draftResponse`. Returns an array of markup suggestions. Button becomes `SEND`.
> 3. **The Trapdoor**: If the Agent clicks `EDIT`, the text area becomes an input field.
> 4. **The Reset Rule**: The exact moment the `onChange` event fires (i.e., the agent types a single character manually altering the text), the UI forcefully revokes the `SEND` state and drops the button back to `PROOF`.
> 5. Consequently, the agent is structurally blocked from sending manually written text without a secondary ML check returning "Clear."

#### 4.3 Dismiss Protocol
When the `PROOF` call returns its array of suggestions (e.g., Tone refinement, grammar), the UI displays them beneath the Draft box. 
- The user can click the `X` icon to "Dismiss" the suggestions. 
- This drops the box from the UI **but does not revoke the `SEND` button state.** Dismissing is confirming visual review.

#### 4.4 Final Execution (`POST /api/hub/resolve/:ticketId`)
When the `SEND` button is finally clicked, the frontend fires the definitive payload:
- `finalResponseText`: The actual string to be mailed via SMTP/Outlook integration.
- `metadata`: Include whether the text was modified from the original AI draft or sent verbatim. (Useful for evaluating LLM success rates).
- The backend must mark the ticket `resolved`, dispatch the email, and return a 200 OK. The UI will then remove the item from the queue organically.
