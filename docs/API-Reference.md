# Sagitine Email Triage System — API Reference

**Version:** 1.0.0  
**Last Updated:** 2025-04-02  
**Base URL:** `https://your-project.vercel.app/api`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Security](#authentication--security)
3. [API Endpoints](#api-endpoints)
   - [POST /api/classify](#post-apiclassify)
   - [POST /api/tickets-send-status](#post-apiticketsidsend-status)
4. [Database Schema Reference](#database-schema-reference)
5. [Integration Guide for Make.com](#integration-guide-for-makecom)
6. [Error Handling](#error-handling)
7. [Rate Limiting & Performance](#rate-limiting--performance)

---

## Overview

The Sagitine Email Triage System provides a serverless API for automatic email classification, AI-drafted response generation, and ticket workflow management. The system is designed to integrate seamlessly with Make.com workflows and Microsoft Outlook.

### Architecture

```
Outlook → Make.com → Vercel API → Neon PostgreSQL
                              ↓
                         Claude 3.5 Sonnet
                              ↓
                         Response Generation
```

### Key Features

- **AI-Powered Classification**: Multi-category email classification with confidence scoring
- **Urgency & Risk Assessment**: Automated priority scoring (1-10) and risk level determination
- **Response Drafting**: AI-generated response drafts with brand-aligned tone
- **Customer Profile Tracking**: Automatic customer history and contact fact recording
- **Idempotent Processing**: Duplicate email detection and prevention

---

## Authentication & Security

### Environment Variables Required

```env
# Database (Neon Postgres)
DATABASE_URL=postgresql://user:password@host/db

# LLM API (Claude 3.5 Sonnet)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Microsoft Graph API (Outlook integration) - Phase 3 only
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id

# App Configuration
VITE_API_BASE_URL=http://localhost:5173/api
NODE_ENV=development

# Feature Flags
ENABLE_AUTO_SEND=false
ENABLE_VECTOR_SEARCH=false
```

### API Key Considerations

- **Production**: Use Vercel Environment Variables for secure storage
- **Development**: Local `.env` file (never commit to git)
- **CORS**: All endpoints allow cross-origin requests from any origin (`*`)

### Security Headers

All API responses include:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## API Endpoints

### POST /api/classify

Classifies an inbound email using AI and generates a response draft. Creates customer profile, records contact facts, and initialises ticket workflow.

#### Endpoint

```
POST /api/classify
```

#### Request Headers

```http
Content-Type: application/json
```

#### Request Body

```json
{
  "from_email": "customer@example.com",
  "from_name": "Jane Customer",
  "subject": "Damaged item received",
  "body_plain": "I received my order today but the Box arrived with a large dent on the side...",
  "body_html": "<p>I received my order today...</p>",
  "timestamp": "2025-04-02T10:30:00Z",
  "message_id": "AAMkADk0ZjY4OTg4LWU5YmYtNDdjOS04MjA1LWY5NjY4ZjY4ZjY4ZgBGAAAAAAA",
  "thread_id": "AAMkADk0ZjY4OTg4LWU5YmYtNDdjOS04MjA1LWY5NjY4ZjY4ZjY4ZgBGAAAAAAA",
  "in_reply_to": "optional-message-id",
  "references": ["array-of-message-ids"]
}
```

**Required Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `from_email` | string | Customer's email address |
| `subject` | string | Email subject line |
| `body_plain` | string | Plain text email body |
| `timestamp` | string | ISO 8601 timestamp when email was received |

**Optional Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `from_name` | string | Customer's name |
| `body_html` | string | HTML email body |
| `message_id` | string | Outlook Message ID (for idempotency) |
| `thread_id` | string | Outlook Thread ID |
| `in_reply_to` | string | Message ID this email replies to |
| `references` | string[] | Array of related message IDs |

#### Response Structure

**Success Response (200):**

```json
{
  "success": true,
  "email_id": "550e8400-e29b-41d4-a716-446655440000",
  "triage_result_id": "660e8400-e29b-41d4-a716-446655440001",
  "ticket_id": "770e8400-e29b-41d4-a716-446655440002",
  "customer_profile_id": "880e8400-e29b-41d4-a716-446655440003",
  "is_new_customer": false,
  "data": {
    "category_primary": "damaged_missing_faulty",
    "confidence": 0.85,
    "urgency": 10,
    "risk_level": "medium",
    "risk_flags": ["mock_enhanced_keyword_based"],
    "customer_intent_summary": "Customer reports damaged item and requests replacement",
    "recommended_next_action": "Request photo evidence and arrange replacement shipment",
    "safe_to_auto_draft": true,
    "safe_to_auto_send": false,
    "retrieved_knowledge_ids": [],
    "reply_subject": "Re: Damaged item received",
    "reply_body": "Hi Jane Customer,\n\nThank you for letting me know about the damage to your Box. I'm sorry to hear it arrived in poor condition.\n\nCould you please send through a photo of the damage? Once I receive this, I'll arrange a replacement shipment for you immediately.\n\nWarm regards,\nHeidi x"
  },
  "timestamp": "2025-04-02T10:31:00Z",
  "_mode": "mock_enhanced"
}
```

**Duplicate Email Response (200):**

```json
{
  "success": true,
  "email_id": "550e8400-e29b-41d4-a716-446655440000",
  "triage_result_id": null,
  "ticket_id": null,
  "duplicate": true,
  "message": "Email already processed - returning existing record",
  "timestamp": "2025-04-02T10:31:00Z",
  "_mode": "mock_enhanced"
}
```

#### Classification Categories

The API returns one of these canonical categories:

| Category ID | Description | Default Urgency |
|-------------|-------------|-----------------|
| `damaged_missing_faulty` | Item arrived damaged, missing parts, faulty | 10 |
| `shipping_delivery_order_issue` | Delivery delays, tracking, shipping changes | 9 |
| `product_usage_guidance` | How to use, assembly, feature questions | 5 |
| `pre_purchase_question` | Questions before buying | 4 |
| `return_refund_exchange` | Return/refund/exchange requests | 9 |
| `stock_availability` | Stock levels, backorders, pre-orders | 6 |
| `partnership_wholesale_press` | B2B inquiries, press, influencer requests | 3 |
| `brand_feedback_general` | General feedback, compliments | 2 |
| `spam_solicitation` | Spam, unsolicited offers | 1 |
| `other_uncategorized` | Cannot classify, low confidence | 5 |
| `account_billing_payment` | Payment issues, billing questions | 8 |
| `order_modification_cancellation` | Change/cancel orders | 10 |
| `praise_testimonial_ugc` | Positive reviews, testimonials | 2 |

#### Example cURL Command

```bash
curl -X POST https://your-project.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "customer@example.com",
    "from_name": "Jane Customer",
    "subject": "Damaged item received",
    "body_plain": "I received my order today but the Box arrived with a large dent on the side.",
    "timestamp": "2025-04-02T10:30:00Z",
    "message_id": "AAMkADk0ZjY4OTg4LWU5YmYtNDdjOS04MjA1LWY5NjY4ZjY4ZjY4ZgBGAAAAAAA"
  }'
```

#### Error Responses

**400 Bad Request - Missing Required Fields:**

```json
{
  "success": false,
  "error": "Missing required fields: from_email, subject, body_plain, timestamp",
  "timestamp": "2025-04-02T10:31:00Z"
}
```

**500 Internal Server Error:**

```json
{
  "success": false,
  "error": "Database connection failed",
  "timestamp": "2025-04-02T10:31:00Z"
}
```

---

### POST /api/tickets-send-status

Marks a ticket as "sent" after a human agent approves and sends the AI-drafted response from Outlook.

#### Endpoint

```
POST /api/tickets-send-status?id=<outlook-message-id>
```

#### Request Headers

```http
Content-Type: application/json
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Outlook Message ID (from original email) |

#### Request Body

```json
{
  "sent_at": "2025-04-02T14:30:00Z",
  "sent_by": "Heidi"
}
```

**Required Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sent_at` | string | ISO 8601 timestamp when email was sent |

**Optional Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sent_by` | string | Name of agent who sent the email |

#### Response Structure

**Success Response (200):**

```json
{
  "success": true,
  "ticket_id": "770e8400-e29b-41d4-a716-446655440002",
  "outlook_message_id": "AAMkADk0ZjY4OTg4LWU5YmYtNDdjOS04MjA1LWY5NjY4ZjY4ZjY4ZgBGAAAAAAA",
  "message": "Ticket marked as sent",
  "timestamp": "2025-04-02T14:31:00Z"
}
```

#### Example cURL Command

```bash
curl -X POST "https://your-project.vercel.app/api/tickets-send-status?id=AAMkADk0ZjY4OTg4LWU5YmYtNDdjOS04MjA1LWY5NjY4ZjY4ZjY4ZgBGAAAAAAA" \
  -H "Content-Type: application/json" \
  -d '{
    "sent_at": "2025-04-02T14:30:00Z",
    "sent_by": "Heidi"
  }'
```

#### Error Responses

**400 Bad Request - Missing Query Parameter:**

```json
{
  "success": false,
  "error": "Outlook Message ID is required (query param: id)",
  "example": "/api/tickets-send-status?id=<outlook-message-id>",
  "timestamp": "2025-04-02T14:31:00Z"
}
```

**400 Bad Request - Missing sent_at:**

```json
{
  "success": false,
  "error": "sent_at is required (ISO timestamp)",
  "timestamp": "2025-04-02T14:31:00Z"
}
```

**404 Not Found - Ticket Not Found:**

```json
{
  "success": false,
  "error": "Ticket not found for this Outlook Message ID",
  "timestamp": "2025-04-02T14:31:00Z"
}
```

**405 Method Not Allowed:**

```json
{
  "success": false,
  "error": "Method not allowed",
  "timestamp": "2025-04-02T14:31:00Z"
}
```

---

## Database Schema Reference

### Core Tables

#### `inbound_emails`

Raw source-of-truth for every inbound email. Stored before any AI classification happens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal record ID |
| `source_message_id` | text | UNIQUE | Outlook Message ID |
| `source_thread_id` | text | | Outlook Thread ID |
| `from_email` | text | NOT NULL | Sender's email address |
| `from_name` | text | | Sender's name |
| `subject` | text | NOT NULL | Email subject line |
| `body_plain` | text | NOT NULL | Plain text body |
| `body_html` | text | | HTML body |
| `source_system` | text | NOT NULL, DEFAULT 'outlook' | Origin system |
| `received_at` | timestamp with time zone | NOT NULL | When email was received |
| `created_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Record creation time |
| `updated_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes:**
- `inbound_emails_source_message_id_idx` (UNIQUE) on `source_message_id`

---

#### `triage_results`

AI classification, scoring, and draft generation. Linked to `inbound_emails` via `email_id`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal record ID |
| `email_id` | uuid | NOT NULL, FK → inbound_emails.id (CASCADE) | Reference to source email |
| `category_primary` | category_enum | NOT NULL | Primary classification category |
| `confidence` | numeric(4,3) | NOT NULL | Classification confidence (0.000-1.000) |
| `urgency` | integer | NOT NULL | Urgency score (1-10) |
| `risk_level` | risk_level_enum | NOT NULL | Risk assessment |
| `risk_flags` | jsonb (string[]) | NOT NULL, DEFAULT [] | Risk flags and warnings |
| `customer_intent_summary` | text | | 1-2 sentence intent summary |
| `recommended_next_action` | text | | Specific recommended action |
| `safe_to_auto_draft` | boolean | NOT NULL, DEFAULT true | Can draft without review |
| `safe_to_auto_send` | boolean | NOT NULL, DEFAULT false | Can send without review |
| `reply_subject` | text | | Generated reply subject |
| `reply_body` | text | | Generated reply body |
| `retrieved_knowledge_ids` | jsonb (string[]) | NOT NULL, DEFAULT [] | Knowledge base references |
| `classifier_version` | text | | Model/version identifier |
| `is_mock` | boolean | NOT NULL, DEFAULT false | Mock classification flag |
| `created_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Record creation time |
| `updated_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Last update time |

**Enums:**

```sql
-- category_enum
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

-- risk_level_enum
'low'
'medium'
'high'
```

---

#### `tickets`

Operational workflow state for the HUD dashboard. Separates workflow status from AI classification output.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal record ID |
| `email_id` | uuid | NOT NULL, FK → inbound_emails.id (CASCADE) | Reference to source email |
| `triage_result_id` | uuid | NOT NULL, FK → triage_results.id (CASCADE) | Reference to classification |
| `status` | ticket_status_enum | NOT NULL, DEFAULT 'classified' | Workflow status |
| `send_status` | send_status_enum | NOT NULL, DEFAULT 'not_applicable' | Send status |
| `assigned_to` | text | | Agent assigned to ticket |
| `approved_at` | timestamp with time zone | | Approval timestamp |
| `approved_by` | text | | Approving agent name |
| `sent_at` | timestamp with time zone | | Send timestamp |
| `send_attempted_at` | timestamp with time zone | | Send attempt timestamp |
| `send_failed_at` | timestamp with time zone | | Send failure timestamp |
| `send_failure_reason` | text | | Failure reason |
| `rejected_at` | timestamp with time zone | | Rejection timestamp |
| `rejected_by` | text | | Rejecting agent name |
| `rejection_reason` | text | | Rejection reason |
| `human_edited` | boolean | NOT NULL, DEFAULT false | Whether draft was edited |
| `human_edited_body` | text | | Edited draft content |
| `archived_at` | timestamp with time zone | | Archive timestamp |
| `created_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Record creation time |
| `updated_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Last update time |

**Enums:**

```sql
-- ticket_status_enum
'new'
'classified'
'approved'
'rejected'
'archived'

-- send_status_enum
'not_applicable'
'pending'
'sent'
'failed'
```

---

### Customer Profile Tables

#### `customer_profiles`

Summary layer for customer service context and history. One row per identifiable customer (email-based identity).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal record ID |
| `email` | text | NOT NULL, UNIQUE | Customer email address |
| `name` | text | | Customer name |
| `phone` | text | | Phone number |
| `preferred_contact_channel` | contact_channel_enum | | Preferred channel |
| `last_contact_channel` | contact_channel_enum | | Last used channel |
| `first_contact_at` | timestamp with time zone | | First contact date |
| `last_contact_at` | timestamp with time zone | | Last contact date |
| `total_contact_count` | integer | NOT NULL, DEFAULT 0 | Total contacts |
| `total_email_count` | integer | NOT NULL, DEFAULT 0 | Total emails |
| `last_contact_category` | category_enum | | Last contact category |
| `last_contact_outcome` | text | | Last contact outcome |
| `damaged_issue_count` | integer | NOT NULL, DEFAULT 0 | Damaged item contacts |
| `delivery_issue_count` | integer | NOT NULL, DEFAULT 0 | Delivery issue contacts |
| `usage_guidance_count` | integer | NOT NULL, DEFAULT 0 | Usage guidance contacts |
| `pre_purchase_count` | integer | NOT NULL, DEFAULT 0 | Pre-purchase contacts |
| `return_refund_count` | integer | NOT NULL, DEFAULT 0 | Return/refund contacts |
| `stock_question_count` | integer | NOT NULL, DEFAULT 0 | Stock question contacts |
| `praise_ugc_count` | integer | NOT NULL, DEFAULT 0 | Praise/UGC contacts |
| `lifetime_issue_count` | integer | NOT NULL, DEFAULT 0 | Total issue count |
| `lifetime_positive_feedback_count` | integer | NOT NULL, DEFAULT 0 | Positive feedback count |
| `is_repeat_contact` | boolean | NOT NULL, DEFAULT false | Repeat contact flag |
| `is_high_attention_customer` | boolean | NOT NULL, DEFAULT false | High attention flag |
| `sentiment_last_known` | text | | Last known sentiment |
| `instagram_handle` | text | | Instagram handle |
| `facebook_profile` | text | | Facebook profile URL |
| `shopify_customer_id` | text | | Shopify customer ID |
| `shopify_order_count` | integer | | Shopify order count |
| `shopify_ltv` | numeric(10,2) | | Shopify lifetime value |
| `last_order_at` | timestamp with time zone | | Last order date |
| `notes_internal` | text | | Internal notes |
| `created_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Record creation time |
| `updated_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes:**
- `customer_profiles_email_idx` (UNIQUE) on `email`

---

#### `customer_contact_facts`

Lightweight event/contact ledger. One row per contact or interaction. Supports rollups into `customer_profiles`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal record ID |
| `customer_profile_id` | uuid | NOT NULL, FK → customer_profiles.id (CASCADE) | Reference to profile |
| `ticket_id` | uuid | FK → tickets.id (SET NULL) | Reference to ticket |
| `email_id` | uuid | FK → inbound_emails.id (SET NULL) | Reference to email |
| `channel` | contact_channel_enum | NOT NULL | Contact channel |
| `direction` | contact_direction_enum | NOT NULL | Inbound/outbound |
| `contact_at` | timestamp with time zone | NOT NULL | Contact timestamp |
| `category` | category_enum | | Contact category |
| `sentiment` | text | | Sentiment label |
| `urgency` | integer | | Urgency score |
| `risk_level` | risk_level_enum | | Risk level |
| `status` | text | | Contact status |
| `resolution_type` | text | | Resolution type |
| `was_human_reviewed` | boolean | NOT NULL, DEFAULT false | Human review flag |
| `was_customer_happy` | boolean | | Customer satisfaction |
| `response_time_minutes` | integer | | Response time in minutes |
| `order_number` | text | | Related order number |
| `had_order_reference` | boolean | NOT NULL, DEFAULT false | Had order reference |
| `had_damage_claim` | boolean | NOT NULL, DEFAULT false | Was damage claim |
| `had_delivery_issue` | boolean | NOT NULL, DEFAULT false | Was delivery issue |
| `had_refund_request` | boolean | NOT NULL, DEFAULT false | Was refund request |
| `had_positive_feedback` | boolean | NOT NULL, DEFAULT false | Was positive feedback |
| `summary` | text | | Contact summary |
| `created_at` | timestamp with time zone | NOT NULL, DEFAULT NOW() | Record creation time |

**Enums:**

```sql
-- contact_channel_enum
'email'
'phone'
'instagram'
'facebook'
'shopify'
'manual'

-- contact_direction_enum
'inbound'
'outbound'
```

---

## Integration Guide for Make.com

### Step 1: Configure Outlook Watch Module

1. Add **Outlook → Watch Emails** module
2. Configure filter:
   - Folder: `Inbox`
   - Mark as read: No
3. Map output fields to variables:
   - `From (Email)` → `from_email`
   - `From (Name)` → `from_name`
   - `Subject` → `subject`
   - `Body (Plain)` → `body_plain`
   - `Body (HTML)` → `body_html`
   - `Received Time` → `timestamp`
   - `Internet Message ID` → `message_id`
   - `Conversation ID` → `thread_id`

### Step 2: Configure HTTP Module (POST /api/classify)

1. Add **HTTP → Make a Request** module
2. Configure:
   - **Method**: POST
   - **URL**: `https://your-project.vercel.app/api/classify`
   - **Headers**:
     ```json
     {
       "Content-Type": "application/json"
     }
     ```
   - **Body** (JSON):
     ```json
     {
       "from_email": "{{from_email}}",
       "from_name": "{{from_name}}",
       "subject": "{{subject}}",
       "body_plain": "{{body_plain}}",
       "body_html": "{{body_html}}",
       "timestamp": "{{timestamp}}",
       "message_id": "{{message_id}}",
       "thread_id": "{{thread_id}}"
     }
     ```

### Step 3: Handle Response & Create Draft

Use a **Switch** module to route based on classification:

```
IF category = "damaged_missing_faulty"
  → Move to "CX / Review / Damaged" folder
ELSE IF category = "shipping_delivery_order_issue"
  → Move to "CX / Review / Shipping" folder
ELSE IF safe_to_auto_send = true
  → Create draft in "CX / Auto-Send" folder
ELSE
  → Create draft in "CX / Review" folder
```

### Step 4: Configure Draft Creation

Add **Outlook → Create Email Draft** module:

- **To**: `{{from_email}}` (from HTTP response)
- **Subject**: `{{reply_subject}}` (from HTTP response `data.reply_subject`)
- **Body**: `{{reply_body}}` (from HTTP response `data.reply_body`)
- **Folder**: Mapped from Switch logic

### Step 5: Track Send Status

After agent sends from Outlook:

1. Trigger workflow on **Email Sent** event
2. Add **HTTP → Make a Request** module:
   - **Method**: POST
   - **URL**: `https://your-project.vercel.app/api/tickets-send-status?id={{message_id}}`
   - **Body**:
     ```json
     {
       "sent_at": "{{sent_timestamp}}",
       "sent_by": "{{sender_name}}"
     }
     ```

### Common Pitfalls & Solutions

#### Pitfall 1: Duplicate Processing

**Problem**: Same email triggers classification multiple times.

**Solution**: 
- Always include `message_id` from Outlook
- API uses idempotency check with `onConflictDoNothing()`
- Check response for `duplicate: true` flag

#### Pitfall 2: Missing Required Fields

**Problem**: API returns 400 error "Missing required fields".

**Solution**:
- Verify all 4 required fields are mapped: `from_email`, `subject`, `body_plain`, `timestamp`
- Check that timestamp is in ISO 8601 format
- Use Make.com's `toString()` function on timestamp fields

#### Pitfall 3: Invalid JSON Structure

**Problem**: API returns 400 error "Invalid JSON".

**Solution**:
- Use Make.com's JSON generator, not text concatenation
- Escape special characters in body text (newlines, quotes)
- Test JSON structure with https://jsonlint.com/

#### Pitfall 4: Timeout Errors

**Problem**: HTTP request times out after 30 seconds.

**Solution**:
- Increase timeout in HTTP module settings (up to 120s)
- Check Vercel function execution logs
- Verify Claude API is responding (check `ANTHROPIC_API_KEY`)

#### Pitfall 5: Wrong Folder Mapping

**Problem**: Drafts appear in wrong Outlook folders.

**Solution**:
- Use exact folder names as configured in Outlook
- Case-sensitive matching
- Test with simple category routing first

### Testing Your Integration

#### Manual Test with cURL

```bash
# Test classification endpoint
curl -X POST https://your-project.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "test@example.com",
    "from_name": "Test Customer",
    "subject": "Where is my order?",
    "body_plain": "I ordered last week and haven't received tracking.",
    "timestamp": "2025-04-02T10:30:00Z",
    "message_id": "test-message-id-12345"
  }'
```

#### Make.com Scenario Test

1. Create test email in your inbox
2. Manually trigger Outlook Watch module
3. Verify HTTP request succeeds (200 status)
4. Check database for new records:
   ```sql
   SELECT * FROM inbound_emails WHERE source_message_id = 'test-message-id-12345';
   SELECT * FROM triage_results WHERE email_id = (SELECT id FROM inbound_emails WHERE source_message_id = 'test-message-id-12345');
   SELECT * FROM tickets WHERE email_id = (SELECT id FROM inbound_emails WHERE source_message_id = 'test-message-id-12345');
   ```
5. Verify draft created in correct Outlook folder

---

## Error Handling

### Standard Error Response Format

All API errors follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "timestamp": "2025-04-02T10:31:00Z"
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request processed successfully |
| 400 | Bad Request | Missing required fields, invalid JSON |
| 404 | Not Found | Ticket not found for given ID |
| 405 | Method Not Allowed | Wrong HTTP method used |
| 500 | Internal Server Error | Database connection, API failures |

### Retry Strategy

- **400 errors**: Do not retry (fix request payload)
- **404 errors**: Do not retry (verify resource exists)
- **500 errors**: Retry with exponential backoff (1s, 2s, 4s, 8s)
- **Timeout**: Retry up to 3 times with increasing timeout

### Logging & Debugging

All API endpoints log errors to Vercel function logs:

```javascript
console.error('API error:', error);
```

Access logs via:
```bash
vercel logs
```

---

## Rate Limiting & Performance

### Current Limits

- **No rate limiting** currently enforced
- **Vercel Function execution time**: Max 10 seconds (Hobby), 60 seconds (Pro)
- **Database connections**: Neon serverless pool (max 10 connections)

### Performance Optimisation

1. **Idempotency**: Duplicate emails detected via unique index (no reprocessing)
2. **Connection pooling**: Drizzle ORM uses serverless pool
3. **Async processing**: Customer profile updates happen in background
4. **Minimal payload**: Only return necessary data in responses

### Recommended Best Practices

1. **Batch operations**: Process emails in batches (max 10 at a time)
2. **Retry with backoff**: Use exponential backoff for 500 errors
3. **Cache responses**: Store classification results locally if needed
4. **Monitor logs**: Check Vercel logs for performance issues

### Monitoring

Monitor these metrics in Vercel Dashboard:

- Function execution time (should be < 5s)
- Error rate (should be < 1%)
- Database connection count (should be < 8)
- Response time (p50: < 1s, p95: < 3s)

---

## Appendix

### Example Full Workflow

```mermaid
sequenceDiagram
    participant Customer
    participant Outlook
    participant Make.com
    participant API
    participant Database
    participant Claude

    Customer->>Outlook: Send email
    Outlook->>Make.com: Webhook trigger
    Make.com->>API: POST /api/classify
    API->>Database: Store inbound_email
    API->>Claude: Classify email
    Claude-->>API: Classification result
    API->>Database: Store triage_result
    API->>Database: Create ticket
    API->>Database: Update customer profile
    API-->>Make.com: Return classification
    Make.com->>Outlook: Create draft
    Outlook->>Customer: Agent reviews & sends
    Make.com->>API: POST /api/tickets-send-status
    API->>Database: Update ticket status
```

### Support & Documentation

- **Project Repo**: [Private Git Repository]
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Neon Console**: https://console.neon.tech
- **Drizzle Docs**: https://orm.drizzle.team

### Changelog

**v1.0.0** (2025-04-02)
- Initial API release
- POST /api/classify endpoint
- POST /api/tickets-send-status endpoint
- Customer profile tracking
- Response strategy generation (Haiku-powered)

---

**Document maintained by:** Sagitine Development Team  
**Last reviewed:** 2025-04-02
