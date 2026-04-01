# Sagitine CX Notification Hub: MVP Backend Data Contract & UI Mapping

This document serves as the holistic data specification for the backend engineering team. It explicitly maps every visual data point shown in the fully expanded `ResolutionConsoleMVP` back to its required data schema, alongside the functional storage requirements once an operator executes a resolution.

---

## 1. Data Hydration Map (By UI Column)

The expanded MVP UI relies on a single master hydration payload per `ticketId` (`HubTicketHydration`). The UI is strictly divided into three distinct operational columns.

### Column 1: Customer Insight & Telemetry (Left)

#### A. Header / Breadcrumbs
*   **Ticket Category ID / Label** (`ticket.categoryLabel`): Used in upper navigation trace (e.g., "QUEUE > DAMAGED & FAULTY").
*   **Customer Display Name** (`customer.name`): Dynamically parsed or extracted from email header.

#### B. Identity Block
*   **Customer Name** (`customer.name`): "Sarah Johnson"
*   **Customer Email** (`customer.email`): "sarah@example.com"
*   **Repeat Badge Rule** (`customer.isRepeatContact`): `boolean`. True if `totalContactCount > 1`.
*   **High Attention Badge Rule** (`customer.isHighAttentionCustomer`): `boolean`. True if previously escalated, high LTV, or defined by custom CRM routing parameters.

#### C. Account Stats (Neon CRM & Shopify)
* **Total Contacts** (`customer.totalContactCount`): `integer`. Lifetime interactions.
* **30-Day Volume** (`customer.thirtyDayVolume`): `integer`. Noise/friction threshold gauge.
* **Last Contact Date** (`customer.lastContactAt`): `ISO Timestamp`. Formatted locally to "14 Oct 25".
* **Last Category** (`customer.lastContactCategory`): `string | null`. The category of their immediate previous ticket (e.g., "Shipping & Delivery"). Determines if the user is stuck in a loop.
* **Pattern Summary** (`customer.patternSummary`): `string | null`. An AI-synthesized or script-generated string identifying CRM noise (e.g., "2 product issues in last 90 days"). *Safely collapses if backend cannot hydrate for MVP.*
* **Total Orders** (`customer.shopifyOrderCount`): `integer | null`. Pulled from commerce layer.
* **Lifetime Value** (`customer.shopifyLtv`): `float | null`. e.g., "$820.00".

#### D. Current Inquiry
*   **Assigned Category** (`ticket.categoryLabel`): "Damaged & Faulty".
*   **Wait Time** (`ticket.waitingMinutes`): `integer`. Dynamically tracks duration since inbound receipt.
*   **Urgency Score** (`ticket.urgency`): `integer (1-10)`. Maps to font colours (Yellow >= 5, Orange >= 8).
*   **Classification Confidence** (`ticket.confidence`): `float (0.00-1.00)`. Renders as percentage (e.g. 0.94 -> 94%).
*   **Risk Level** (`ticket.riskLevel`): `enum ('low' | 'medium' | 'high')`. Generates the red/yellow/green severity badge.

---

### Column 2: Triage & Origin Context (Middle)

#### A. AI Triage Analysis
*   **Intent Summary** (`triage.aiSummary`): `string`. A tight 1-2 sentence paragraph distilling the customer's problem without making the operator read the full thread.
*   **Recommended Action** (`ticket.recommendedNextAction`): `string`. The AI-postulated next operational step (e.g., "Arrange replacement and request photo evidence if required.").

#### B. Original Message
*   **Subject Line** (`message.subject`): The raw email subject line.
*   **Received Timestamp** (`ticket.receivedAt`): `ISO Timestamp`. Formatted to `HH:MM`.
*   **Message Body** (`message.fullMessage`): The raw, unadulterated email content exactly as the customer typed it.

---

### Column 3: The Generation Engine (Right)

#### A. Draft Workspace
*   **Draft Payload** (`triage.draftResponse`): `string`. The initial LLM-generated reply (Haiku). This string populates the Textbox upon ticket open.

#### B. Proofing Data Layer (Triggered post-proofing)
*   **Proofing Suggestions** (`triage.proofingSuggestions`): `string[] | null`. An array of bullet points returned by the Haiku language model after the operator presses "PROOF". Ex: `["Tone refinement: Adjusted opening slightly for empathy...", "Grammar: Corrected to AU/UK spelling."]`. *If null or empty, UI falls back to a generic green verified banner.*

---

## 2. Functional & Data Storage Requirements (Post-Resolution)

When the operator clicks the **"SEND RESPONSE"** CTA, the UI executes the resolution Promise. During this transient "Dispatching..." state, the backend is responsible for specific integrations:

### A. Dispatch Pipeline (The Action)
1.  **Draft Extraction:** The finalized string (whether human-edited or raw AI draft) is extracted.
2.  **Outlook / Email API Payload:** The backend triggers sending via Microsoft Graph API (or selected email relay) threading precisely to the `message.emailId` with the exact finalized copy.
3.  **Ticket Status Mutator:** The ticket transitions from `status: new` or `status: drafted` strictly to `status: resolved`.

### B. Neon CRM Logging (The Memory)
Instantly after dispatch, the interaction must be appended back into the Neon lightweight CRM to influence the `Account Stats` of the customer's next incoming ticket:

1.  **Append Interaction Event:**
    *   `Timestamp`: When the send occurred.
    *   `Category`: "damaged_missing_faulty".
    *   `Resolution Mechanism`: E.g., `ai_drafted`, `human_edited`, `human_proofed`.
2.  **Increment Base Counters:**
    *   `customer.totalContactCount` increases by `+1`.
    *   `customer.thirtyDayVolume` increases by `+1`.
3.  **Pattern Tracking Logic:**
    *   Overwrite `customer.lastContactCategory` with the current ticket's category.
    *   Execute an update to the `patternSummary` generation logic based on the historic volume (e.g., *if 30-day volume > 2 and categories point to faults, prepare "High return risk" pattern warning for next load*). 
4.  **AI Auditing Matrix:**
    *   Save the initial `triage.draftResponse`.
    *   Save the `finalMessageSent` (to continuously train the discrepancy delta).
    *   Save the `ticket.confidence` rating internally to audit triage prediction efficacy.
