# Make.com Integration Guide

## Production Endpoints

Replace `sagitine-hud.vercel.app` with your actual Vercel deployment URL.

---

## MODULE 2: Classify Incoming Email

**HTTP / Make a Request**

### Configuration

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `https://sagitine-hud.vercel.app/api/classify` |
| **Content Type** | JSON |
| **Headers** | `Content-Type: application/json` |

### Request Body (from Outlook email module)

```json
{
  "from_email": "{{[[From Email]]}}",
  "from_name": "{{[[From Name]]}}",
  "subject": "{{[[Subject]]}}",
  "body_plain": "{{[[Body Plain Text]]}}",
  "body_html": "{{[[Body HTML]]}}",
  "timestamp": "{{[[Timestamp]]}}",
  "message_id": "{{[[Message ID]]}}",
  "thread_id": "{{[[Thread ID]]}}"
}
```

### Response Handling

**Success (200):**
```json
{
  "success": true,
  "data": {
    "category_primary": "damaged_missing_faulty",
    "confidence": 0.85,
    "urgency": 9,
    "risk_level": "high",
    "customer_intent_summary": "Customer reports damaged product",
    "recommended_next_action": "Arrange replacement",
    "safe_to_auto_draft": true,
    "safe_to_auto_send": false,
    "ticket_id": "uuid-here",
    "customer_profile_id": "uuid-here"
  },
  "timestamp": "2026-04-01T10:00:00.000Z"
}
```

**Error (4xx/5xx):**
```json
{
  "success": false,
  "error": "Error message here",
  "timestamp": "2026-04-01T10:00:00.000Z"
}
```

### Make Router Configuration

**Route based on:**

1. **Category** (for folder routing)
   - `data.category_primary`
   - Route to different Outlook folders based on category

2. **Urgency** (for prioritization)
   - `data.urgency >= 8` → High priority queue
   - `data.urgency < 8` → Standard queue

3. **Safe to Auto-Draft** (for draft creation)
   - `data.safe_to_auto_draft === true` → Create draft automatically
   - `data.safe_to_auto_draft === false` → Manual review required

---

## MODULE 3: Draft Creation (Optional)

If `safe_to_auto_draft === true`, call:

**POST /api/tickets/{ticket_id}/draft**

```json
{
  "regenerate": false
}
```

This will generate a draft response stored in the database.

---

## MODULE 4: Send Callback

After sending a draft from Outlook, notify the system:

**POST /api/tickets/{ticket_id}/sent**

```json
{
  "sent_at": "2026-04-01T10:00:00.000Z",
  "outlook_message_id": "outlook-message-id"
}
```

---

## MODULE 5: Failure Callback (Optional)

If send fails:

**POST /api/tickets/{ticket_id}/failed**

```json
{
  "failed_at": "2026-04-01T10:00:00.000Z",
  "error_reason": "Error description"
}
```

---

## TESTING IN MAKE.COM

### 1. Health Check First

**GET /api/health**

Expected response:
```json
{
  "status": "ok",
  "service": "sagitine-ai-cx-agent",
  "version": "1.0.0",
  "timestamp": "2026-04-01T10:00:00.000Z"
}
```

### 2. Test Classify

Use a test email payload:

```json
{
  "from_email": "test@example.com",
  "subject": "Box arrived damaged",
  "body_plain": "Hi, my order arrived damaged. Can you send a replacement?",
  "timestamp": "2026-04-01T10:00:00.000Z"
}
```

Expected: `category_primary: "damaged_missing_faulty"`, `urgency: 9`

---

## MAKE.COM SCENARIO DESIGN

### Scenario 1: Standard Flow

```
1. Watch Emails (Outlook)
   ↓
2. HTTP / Make a Request → POST /api/classify
   ↓
3. Router (based on category)
   ↓
4. Create Draft (if safe_to_auto_draft)
   ↓
5. Move Email to Folder (category-based)
```

### Scenario 2: Manual Review Required

```
1. Watch Emails (Outlook)
   ↓
2. HTTP / Make a Request → POST /api/classify
   ↓
3. Filter: safe_to_auto_draft === false
   ↓
4. Move Email to "CX / Review" folder
   ↓
5. Notify Team (optional webhook)
```

### Scenario 3: High Priority

```
1. Watch Emails (Outlook)
   ↓
2. HTTP / Make a Request → POST /api/classify
   ↓
3. Filter: urgency >= 8
   ↓
4. Send Slack/Teams notification
   ↓
5. Create Draft immediately
   ↓
6. Move Email to "CX / Urgent" folder
```

---

## TROUBLESHOOTING

### Make.com returns "Connection refused"

- Verify Vercel deployment is live
- Check URL is correct (no trailing slashes)
- Verify API route exists

### Make.com returns "400 Bad Request"

- Check request body JSON structure
- Verify all required fields are present
- Check Content-Type header is "application/json"

### Make.com returns "500 Internal Server Error"

- Check Vercel function logs
- Verify environment variables are set
- Check database connection
- Verify Anthropic API key

### Response missing expected fields

- Check API version in response
- Verify deployment is latest version
- Check Vercel deployment logs for errors

---

## PERFORMANCE TIPS

1. **Batch Processing**: Process emails in batches of 10-20
2. **Error Handling**: Always check `success` field in response
3. **Retries**: Add retry logic for 500 errors (3 retries max)
4. **Timeout**: Set 30-second timeout for classify endpoint
5. **Logging**: Log all API responses for debugging

---

## SECURITY NOTES

1. **API Keys**: Never expose Anthropic API key in Make.com
2. **HTTPS**: Always use HTTPS endpoints
3. **Rate Limits**: Implement rate limiting (100 requests/minute max)
4. **Authentication**: Consider adding API key authentication in production
5. **IP Whitelist**: Consider whitelisting Make.com IPs in Vercel

---

## SUPPORT

If you encounter issues:

1. Check Vercel deployment logs
2. Test endpoints directly with curl first
3. Verify Make.com payload structure
4. Check environment variables in Vercel dashboard
5. Review API response in Make.com debugging panel
