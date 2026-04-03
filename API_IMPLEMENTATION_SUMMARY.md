# API Classification & Draft Generation Layer - Implementation Summary

**Date:** 2026-03-31
**Phase:** Runtime Intelligence Layer
**Status:** ✅ Complete

---

## Overview

Built the minimum API layer required to classify inbound emails using Claude 3.5 Sonnet, retrieve relevant knowledge base entries, and generate Sagitine-aligned draft responses.

---

## Deliverables

### 1. API Endpoint ✅

**File:** `src/api/index.ts`

**Endpoints:**
- `POST /api/classify` - Classify inbound email and generate draft
- `GET /api/health` - Health check
- `GET /api/categories` - List canonical categories

**Features:**
- Request validation using Zod schemas
- CORS enabled for Make.com webhook integration
- Structured error handling
- Type-safe responses

---

### 2. Claude Classification Client ✅

**File:** `src/api/services/claude-classifier.ts`

**Capabilities:**
- Classifies emails into 8 canonical categories
- Assigns urgency (1-10) based on customer impact
- Assesses risk level (low/medium/high) for auto-send determination
- Generates Sagitine-aligned draft responses
- Enforces tone rules (warm, composed, confident, not apologetic)
- Enforces terminology (always "Box"/"Stand", never "drawer"/"unit")

**Claude Model:** claude-3-5-sonnet-20240620
**Temperature:** 0.3 (consistent classification)
**Max Tokens:** 2000

---

### 3. Knowledge Retrieval Layer ✅

**File:** `src/api/services/knowledge-retrieval.ts`

**Retrieves from:**
- `gold_responses` table (synthesized templates)
- `knowledge_snippets` table (policies, facts, guidance)

**Methods:**
- `getGoldResponsesByCategory()` - Get response templates by category
- `getKnowledgeSnippetsByCategory()` - Get snippets by category
- `getKnowledgeByCategory()` - Get all knowledge for a category
- `searchKnowledge()` - Keyword-based search (fallback for uncertain cases)

**Database:** Neon PostgreSQL via Drizzle ORM
**Schema:** 2 tables with canonical category enums

---

### 4. Request/Response Schema ✅

**File:** `src/api/types.ts`

**Canonical Categories (8):**
```typescript
- damaged_missing_faulty
- shipping_delivery_order_issue
- product_usage_guidance
- pre_purchase_question
- return_refund_exchange
- stock_availability
- partnership_wholesale_press
- brand_feedback_general
```

**Request Schema:**
```typescript
interface InboundEmailPayload {
  from_email: string;        // Required
  from_name?: string;         // Optional
  subject: string;           // Required
  body_plain: string;        // Required
  body_html?: string;        // Optional
  timestamp: string;         // ISO 8601
  message_id?: string;       // Optional
  thread_id?: string;        // Optional
  in_reply_to?: string;      // Optional
  references?: string[];     // Optional
}
```

**Response Schema:**
```typescript
interface ClassificationResult {
  category_primary: CanonicalCategory;
  category_secondary?: CanonicalCategory;
  confidence: number;          // 0-1
  urgency: 1-10;
  risk_level: 'low' | 'medium' | 'high';
  risk_flags: string[];
  customer_intent_summary: string;
  recommended_next_action: string;
  safe_to_auto_draft: boolean;
  safe_to_auto_send: boolean;
  retrieved_knowledge_ids: string[];
  reply_subject: string;
  reply_body: string;
}
```

---

### 5. Example Test Payload ✅

**File:** `src/api/test-examples.ts`

**Test Case 1: Damaged Item**
```json
{
  "from_email": "sarah.johnson@example.com",
  "from_name": "Sarah Johnson",
  "subject": "Re: Order #438325301 - Damaged box received",
  "body_plain": "Hi Heidi,\n\nI just received my Florence 8-Box Stand in Black today and unfortunately one of the boxes arrived with a dent in the side...",
  "timestamp": "2026-03-31T10:30:00Z"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "category_primary": "damaged_missing_faulty",
    "confidence": 0.92,
    "urgency": 9,
    "risk_level": "medium",
    "customer_intent_summary": "Customer received a damaged box and is requesting a replacement",
    "recommended_next_action": "Request photo evidence and arrange replacement shipment",
    "safe_to_auto_draft": true,
    "safe_to_auto_send": false,
    "reply_subject": "Re: Order #438325301 - Damaged box received",
    "reply_body": "Hi [Customer Name],\n\nThank you for letting us know about this issue..."
  }
}
```

**Test Cases Included:**
1. ✅ Damaged item (high urgency, medium risk)
2. ✅ Shipping inquiry (medium urgency, low risk)
3. ✅ Product usage (low urgency, low risk)
4. ✅ Partnership request (low urgency, high risk)

---

### 6. Implementation Details

**Tone Enforcement:**
- Removes "I'm sorry" → "Thank you for letting me know"
- Removes "We apologize" → "Thank you for bringing this to our attention"
- Replaces "drawer"/"unit" → "Box"
- Ensures proper greeting and closing
- Composed, confident, warm but not casual

**Auto-Send Rules:**
- Never auto-send HIGH risk
- Only auto-send LOW risk with confidence ≥ 0.85
- Everything else requires human review
- HIGH risk categories: partnership_wholesale_press

**Urgency Scoring:**
- 10: Critical (damaged item, urgent replacement)
- 8-9: High (return/refund, delivery issues)
- 6-7: Medium (stock questions, pre-purchase)
- 4-5: Low (general inquiries)
- 2-3: Very low (compliments, brand feedback)
- 1: Administrative (partnership declines)

**Risk Level Determination:**
- HIGH: Legal/financial implications, business decisions
- MEDIUM: Complex issues, may need clarification
- LOW: Routine inquiries, template sufficient

---

### 7. Files Created

```
src/api/
├── index.ts                          # API routes (Hono app)
├── types.ts                          # TypeScript types & schemas
├── services/
│   ├── claude-classifier.ts          # Claude client
│   └── knowledge-retrieval.ts        # Knowledge retrieval
└── test-examples.ts                  # Test payloads & responses

api-server.ts                         # Local dev server entry point
vercel.json                           # Vercel deployment config
```

---

### 8. How to Test

**Local Development:**
```bash
# Start API server
npx tsx api-server.ts

# Test with curl (from another terminal)
curl -X POST http://localhost:3001/api/classify \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

**Run Test Examples:**
```bash
# Add to package.json scripts:
"test:api": "npx tsx -e \"import { runTest, TEST_PAYLOAD_DAMAGED } from './src/api/test-examples'; runTest(TEST_PAYLOAD_DAMAGED);\""

# Run test:
npm run test:api
```

---

### 9. Dependencies Added

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@hono/zod-validator": "^0.x",
    "zod": "^3.x",
    "@hono/node-server": "^1.x"
  }
}
```

---

### 10. Blockers Before Make.com Integration

**Resolved ✅:**
- API endpoint structure defined
- Request/response schemas finalized
- Knowledge retrieval functional
- Claude classification tested

**Remaining:**
- ⚠️ **Deployment target:** API needs to be deployed to Vercel/AWS Lambda
  - Current setup: Vercel ready (vercel.json included)
  - Action required: Deploy and get API URL

- ⚠️ **Environment variables:** Make.com needs API credentials
  - Current: .env populated locally
  - Action required: Configure in Make.com scenario

- ⚠️ **CORS configuration:** May need to whitelist Make.com domains
  - Current: CORS enabled for make.com
  - Action required: Test webhook integration

---

## Next Steps (Not in Scope)

1. **React Dashboard** - Display metrics and review queue
2. **Make.com Scenarios** - Configure webhook triggers
3. **Microsoft Graph** - Direct Outlook integration (if needed)

---

## Summary

✅ API classification layer complete
✅ Claude 3.5 Sonnet integration working
✅ Knowledge base retrieval functional
✅ Sagitine tone enforcement applied
✅ Auto-send safety rules implemented
✅ Test payloads and responses documented

**Ready for:** Deployment and Make.com integration testing
