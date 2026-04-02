# Sagitine Email Triage System - Troubleshooting Guide

> **Last Updated:** 2 April 2026  
> **System Version:** 1.0.0  
> **Status:** Live Production  
> **Related Docs:** [Operations Runbook](./Sagitine-Operations-Runbook.md) | [Architecture](../SAGITINE_ARCHITECTURE.md)

---

## 📋 Table of Contents

1. [Quick Diagnostic Flowchart](#quick-diagnostic-flowchart)
2. [Common Issues & Symptoms](#common-issues--symptoms)
3. [Diagnostic Procedures](#diagnostic-procedures)
4. [Quick Reference Solutions](#quick-reference-solutions)
5. [Error Message Reference](#error-message-reference)
6. [Preventive Measures](#preventive-measures)
7. [Escalation Path](#escalation-path)
8. [Emergency Procedures](#emergency-procedures)

---

## Quick Diagnostic Flowchart

```
Email Not Processing?
│
├─ Is Make.com scenario active?
│  ├─ NO → Turn on Scenario 1 or Scenario 2
│  └─ YES → Check scenario logs for errors
│
├─ Is Vercel deployment healthy?
│  ├─ NO → Check Vercel status page, redeploy if needed
│  └─ YES → Test API endpoint manually
│
├─ Is database accessible?
│  ├─ NO → Check Neon console, verify connection string
│  └─ YES → Check for duplicate records
│
└─ Is email content valid?
   └─ NO → Check Make.com payload structure
```

---

## Common Issues & Symptoms

### 1. Email Not Classified (Stuck in Inbox)

**Symptoms:**
- Email sits in Outlook Inbox, never moves to "02_AI Drafted"
- No draft created
- Make.com scenario shows no activity

**Possible Causes:**
- Make.com Scenario 1 is turned off or paused
- Outlook webhook trigger not firing
- API endpoint `/api/classify` is down or returning errors
- Email content missing required fields
- Duplicate email already processed (idempotency)

---

### 2. Draft Created with Wrong Category

**Symptoms:**
- Email moves to incorrect subfolder
- Classification category doesn't match email content
- Urgency score seems wrong

**Possible Causes:**
- Keyword-based classification logic misfiring
- Claude API timeout (fallback to mock classifier)
- Training data/examples insufficient for this email type

---

### 3. Sent Email Not Marked as "Sent"

**Symptoms:**
- Email sent manually from Outlook
- Ticket status in dashboard remains "classified" (should be "sent")
- Database `send_status` field stays "not_applicable"

**Possible Causes:**
- Make.com Scenario 2 is turned off
- Sent email doesn't contain `<!--EMAIL_ID:xxx-->` marker
- `/api/tickets-send-status` endpoint returning 404 or 500
- Database join query failing (ticket not found)
- Outlook Message ID changed (forwarding/reply chains)

---

### 4. Duplicate Emails Processed

**Symptoms:**
- Same email appears multiple times in dashboard queue
- Multiple drafts created for same email
- Database shows duplicate `source_message_id` records

**Possible Causes:**
- Make.com webhook triggered multiple times
- Idempotency check failing in `/api/classify`
- Race condition in database writes
- Outlook rules creating duplicates

---

### 5. Make.com Scenario Errors

**Symptoms:**
- Red error indicators on modules
- Scenario stops mid-execution
- "Operation timed out" errors
- "Rate limit exceeded" errors

**Possible Causes:**
- Vercel API endpoint timeout (> 60 seconds)
- Database connection pool exhausted
- Claude API rate limiting
- Invalid JSON payload from Make.com
- Network connectivity issues

---

### 6. Dashboard Not Loading

**Symptoms:**
- Sagitine HUD shows blank screen
- "Failed to fetch" errors in browser console
- Metrics show "Loading..." indefinitely

**Possible Causes:**
- `/api/metrics` endpoint down
- Database connection failed
- CORS configuration issue
- Vercel deployment failed

---

## Diagnostic Procedures

### A. Check Make.com Scenario Logs

**Step 1: Access Scenario**
1. Log in to [Make.com](https://www.make.com)
2. Open scenario: "Sagitine Service - Inbound Triage 💁"
3. Look for red error indicators on any module

**Step 2: Review Execution History**
1. Click the "clock" icon (Scenario history)
2. Find the failed execution (red "X")
3. Click to expand and see which module failed
4. Note the error message

**Step 3: Inspect Module Data**
1. Click on any module to see input/output data
2. Verify payload structure matches API expectations
3. Check for missing fields or invalid data types

**Common Make.com Error Messages:**
```
"Request has timed out" → API took > 60s to respond
"Bad Request" → Invalid JSON payload
"Unauthorized" → Missing or invalid API key
"Too Many Requests" → Rate limiting from Claude or Vercel
```

---

### B. Check Vercel Deployment Logs

**Step 1: Access Vercel Dashboard**
1. Log in to [Vercel](https://vercel.com)
2. Select project: `sagitine-hud`
3. Click "Deployments" tab

**Step 2: View Function Logs**
1. Click on latest deployment
2. Look for "Functions" tab
3. Find `/api/classify` or `/api/tickets-send-status`
4. Click "View Logs" to see real-time errors

**Step 3: Check Build Logs**
1. If deployment failed, check "Build Logs"
2. Look for TypeScript errors or missing dependencies
3. Verify environment variables are set

**Step 4: Test API Health**
```bash
# Health check
curl https://sagitine-hud.vercel.app/api/health

# Expected response:
{
  "status": "ok",
  "service": "sagitine-ai-cx-agent",
  "version": "1.0.0",
  "timestamp": "2026-04-02T10:30:00.000Z"
}
```

---

### C. Verify Database Records

**Step 1: Access Drizzle Studio**
```bash
cd sagitine-hud
npx drizzle-kit studio
```

**Step 2: Check for Records**
1. Open `inbound_emails` table
2. Search by email subject or sender
3. Verify `source_message_id` matches Outlook Message ID
4. Check `received_at` timestamp is recent

**Step 3: Verify Linked Records**
1. Click on email record
2. Check if `triage_results` record exists (linked via `email_id`)
3. Check if `tickets` record exists (linked via `triage_result_id`)
4. Verify `status` and `send_status` fields

**Common Database Issues:**
- `inbound_emails` exists but no `triage_results` → Classification failed
- `triage_results` exists but no `tickets` → Ticket creation failed
- `tickets.send_status` = "not_applicable" → Scenario 2 didn't run
- Duplicate `source_message_id` → Idempotency broken

---

### D. Test API Endpoints Manually

**Test Classification Endpoint:**
```bash
curl https://sagitine-hud.vercel.app/api/classify -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "test@example.com",
    "from_name": "Test Customer",
    "subject": "My order is damaged",
    "body_plain": "I received a damaged item, please help",
    "timestamp": "2026-04-02T10:30:00Z",
    "message_id": "test-message-123"
  }'
```

**Expected Success Response:**
```json
{
  "success": true,
  "email_id": "uuid-here",
  "triage_result_id": "uuid-here",
  "ticket_id": "uuid-here",
  "customer_profile_id": "uuid-here",
  "data": {
    "category_primary": "damaged_missing_faulty",
    "urgency": 10,
    "risk_level": "medium",
    "reply_subject": "Re: My order is damaged",
    "reply_body": "Hi Test Customer,..."
  },
  "_mode": "mock_enhanced"
}
```

**Test Send Status Endpoint:**
```bash
# First, get a valid ticket_id from database
curl "https://sagitine-hud.vercel.app/api/tickets-send-status?id=<outlook-message-id>" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "sent_at": "2026-04-02T10:30:00Z",
    "sent_by": "Heidi"
  }'
```

**Expected Success Response:**
```json
{
  "success": true,
  "ticket_id": "uuid-here",
  "outlook_message_id": "outlook-message-id",
  "message": "Ticket marked as sent",
  "timestamp": "2026-04-02T10:30:00.000Z"
}
```

---

### E. Debug Email Flow

**Trace Email End-to-End:**

1. **Outlook → Make.com**
   - Check email arrives in Outlook Inbox
   - Verify Make.com scenario triggers (check history)
   - Confirm webhook payload includes all fields

2. **Make.com → Vercel API**
   - Check Make.com HTTP module logs
   - Verify request URL is correct
   - Check response status code (200 = success)

3. **Vercel API → Database**
   - Check Vercel function logs
   - Verify database insert queries succeeded
   - Check for any database errors

4. **Database → Dashboard**
   - Refresh dashboard (hard refresh: Ctrl+Shift+R)
   - Check browser console for errors
   - Verify metrics update

**Useful Query for Debugging:**
```sql
-- Find all records for a specific email
SELECT 
  ie.subject,
  ie.from_email,
  ie.received_at,
  tr.category_primary,
  tr.urgency,
  t.status,
  t.send_status
FROM inbound_emails ie
LEFT JOIN triage_results tr ON ie.id = tr.email_id
LEFT JOIN tickets t ON tr.id = t.triage_result_id
WHERE ie.from_email = 'customer@example.com'
ORDER BY ie.received_at DESC;
```

---

## Quick Reference Solutions

### Issue: Email Not Classified

**Quick Fix Checklist:**
1. ✓ Check Make.com Scenario 1 is ON
2. ✓ Check `/api/health` endpoint responds
3. ✓ Test `/api/classify` manually (see above)
4. ✓ Check Make.com scenario logs for errors
5. ✓ Verify email has required fields

**Step-by-Step Resolution:**

**If Make.com scenario is OFF:**
1. Open Make.com
2. Navigate to "Sagitine Service - Inbound Triage 💁"
3. Click "ON" switch to activate
4. Test with sample email

**If API endpoint is down:**
1. Check Vercel deployment status
2. Look for recent deployments that may have broken code
3. Rollback to previous working version if needed
4. Check Vercel status page: https://www.vercel-status.com

**If database connection failed:**
1. Check Neon console: https://console.neon.tech
2. Verify database is online (not paused/suspended)
3. Check connection string in Vercel environment variables
4. Test connection: `npx drizzle-kit studio`

**If email missing required fields:**
1. Check Make.com "Watch Emails" module configuration
2. Verify data mapping includes:
   - `from_email` (required)
   - `subject` (required)
   - `body_plain` (required)
   - `timestamp` (required)
   - `message_id` (for idempotency)

---

### Issue: Wrong Category Classification

**Quick Fix Checklist:**
1. ✓ Review email content and subject
2. ✓ Check keyword matching logic in `classify.ts`
3. ✓ Verify category enum matches schema

**Step-by-Step Resolution:**

**Check Current Classification:**
```bash
# Query database for classification details
npx drizzle-kit studio
# Find triage_results record for the email
# Check category_primary, urgency, risk_level
```

**Update Classification Logic (if needed):**
1. Open `sagitine-hud/api/classify.ts`
2. Find keyword matching logic (lines 29-108)
3. Add new keywords or adjust priority
4. Deploy changes to Vercel
5. Test with similar email

**Temporary Workaround:**
1. Manually move email to correct folder in Outlook
2. Edit draft response manually
3. Send as normal
4. Document pattern for future classifier improvement

---

### Issue: Sent Email Not Marked as "Sent"

**Quick Fix Checklist:**
1. ✓ Check Make.com Scenario 2 is ON
2. ✓ Verify sent email contains `<!--EMAIL_ID:xxx-->`
3. ✓ Test `/api/tickets-send-status` manually
4. ✓ Check database join query

**Step-by-Step Resolution:**

**Verify EMAIL_ID Marker:**
1. Open sent email in Outlook
2. View source (File > Properties > Internet Headers)
3. Search for `<!--EMAIL_ID:`
4. If missing, check Make.com Module 5 (Create Draft) body content

**Check Scenario 2 Status:**
1. Open Make.com
2. Navigate to "Sagitine Service - Approval & Send 📩"
3. Verify scenario is ON
4. Check "Watch Sent Items" trigger is active

**Test Send Status Endpoint:**
```bash
# Get ticket_id from database first
curl "https://sagitine-hud.vercel.app/api/tickets-send-status?id=<outlook-message-id>" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"sent_at": "2026-04-02T10:30:00Z", "sent_by": "Heidi"}'
```

**If API returns 404 (Ticket Not Found):**
1. Check `inbound_emails` table for `source_message_id`
2. Check `tickets` table exists for that email
3. Verify database join query is correct
4. Check for race condition (email not fully processed when sent)

**Manual Database Update (Emergency Only):**
```sql
-- Find ticket by email subject
SELECT t.id, ie.subject 
FROM tickets t
JOIN inbound_emails ie ON t.email_id = ie.id
WHERE ie.subject = 'Your Email Subject';

-- Update send status
UPDATE tickets
SET send_status = 'sent',
    sent_at = NOW()
WHERE id = 'ticket-uuid-here';
```

---

### Issue: Duplicate Emails Processed

**Quick Fix Checklist:**
1. ✓ Check for duplicate `source_message_id` in database
2. ✓ Verify idempotency logic in `/api/classify`
3. ✓ Check Make.com webhook trigger frequency

**Step-by-Step Resolution:**

**Check for Duplicates:**
```sql
-- Find duplicate source_message_id
SELECT source_message_id, COUNT(*) 
FROM inbound_emails 
GROUP BY source_message_id 
HAVING COUNT(*) > 1;
```

**Verify Idempotency Logic:**
1. Open `sagitine-hud/api/classify.ts`
2. Check lines 181-217 (onConflictDoNothing)
3. Verify logic returns existing record on duplicate

**If Duplicates Exist:**
1. Identify which record is correct (usually earliest)
2. Delete duplicates manually:
```sql
-- Delete duplicates (keep earliest)
DELETE FROM inbound_emails
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY source_message_id 
      ORDER BY created_at ASC
    ) as rn
    FROM inbound_emails
  ) t
  WHERE rn > 1
);
```

**Prevent Future Duplicates:**
1. Check Make.com "Watch Emails" trigger
2. Verify filters don't match same email multiple times
3. Add unique constraint if missing

---

### Issue: Make.com Scenario Errors

**Quick Fix Checklist:**
1. ✓ Check which module failed
2. ✓ Review error message in scenario history
3. ✓ Verify API endpoint is accessible
4. ✓ Check for rate limiting

**Common Error Solutions:**

**"Request has timed out" (> 60s):**
- Cause: API took too long to respond
- Fix: Optimize API code or increase Vercel function timeout
- Temporary: Reduce batch size in Make.com

**"Bad Request" (400):**
- Cause: Invalid JSON payload
- Fix: Check Make.com data mapping, ensure all required fields present
- Verify: Test payload manually with curl

**"Unauthorized" (401):**
- Cause: Missing or invalid authentication
- Fix: Check API keys in Vercel environment variables
- Verify: No hardcoded credentials in code

**"Too Many Requests" (429):**
- Cause: Rate limiting from Claude or Vercel
- Fix: Implement backoff/retry logic
- Temporary: Reduce Make.com polling frequency

**"Internal Server Error" (500):**
- Cause: Unhandled exception in API code
- Fix: Check Vercel function logs for stack trace
- Verify: Database operations wrapped in try/catch

---

## Error Message Reference

### API Error Messages

**400 Bad Request**
```json
{
  "success": false,
  "error": "Missing required fields: from_email, subject, body_plain, timestamp",
  "timestamp": "2026-04-02T10:30:00.000Z"
}
```
**Solution:** Check Make.com payload includes all required fields

---

**404 Not Found (Send Status)**
```json
{
  "success": false,
  "error": "Ticket not found for this Outlook Message ID",
  "timestamp": "2026-04-02T10:30:00.000Z"
}
```
**Solution:** 
- Verify email was processed through Scenario 1 first
- Check `inbound_emails` table for `source_message_id`
- Check `tickets` table exists for that email

---

**405 Method Not Allowed**
```json
{
  "success": false,
  "error": "Method not allowed"
}
```
**Solution:** Ensure Make.com HTTP module uses POST method

---

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Unknown error",
  "timestamp": "2026-04-02T10:30:00.000Z"
}
```
**Solution:**
- Check Vercel function logs for detailed error
- Verify database connection is healthy
- Check for unhandled exceptions in API code

---

### Database Error Messages

**"Connection refused"**
**Solution:** Check database is online (not paused/suspended)

**"Relation 'inbound_emails' does not exist"**
**Solution:** Run database migrations: `npx drizzle-kit push`

**"Unique constraint violation"**
**Solution:** Duplicate `source_message_id` - check idempotency logic

---

### Make.com Error Messages

**"The module is in error"**
**Solution:** Click module to see detailed error message

**"Operation timed out"**
**Solution:** API took > 60s - optimize code or check Vercel logs

**"Too Many Requests"**
**Solution:** Rate limiting - reduce polling frequency or upgrade plan

---

## Preventive Measures

### Daily Health Checks

**Morning Checklist (5 minutes):**
1. ✓ Make.com Scenario 1 status is ON
2. ✓ Make.com Scenario 2 status is ON
3. ✓ No red error indicators in scenarios
4. ✓ Dashboard loads and shows metrics
5. ✓ Recent emails visible in queue

**Weekly Review (15 minutes):**
1. Review Make.com scenario logs for warnings
2. Check Vercel deployment logs for errors
3. Verify database storage usage (< 80%)
4. Test classification with sample email
5. Review uncategorized email patterns

---

### Monitoring Setup

**Key Metrics to Track:**
- Emails processed per day
- Average classification time
- Error rate (target: < 1%)
- Database query performance
- API response time (target: < 5s)

**Set Up Alerts:**
- Make.com scenario failure (immediate)
- API error rate > 5% (immediate)
- Disk usage > 80% (warning)
- No emails processed for 2+ hours (critical)

**Recommended Tools:**
- Vercel Analytics (built-in)
- Make.com error notifications (email)
- Database monitoring (Neon console)
- Uptime monitoring (Pingdom/UptimeRobot)

---

### Warning Signs to Watch

**Early Warning Signs:**
- Slower classification times
- Occasional API timeouts
- Increased error rate in logs
- Database connection warnings
- Make.com scenarios pausing unexpectedly

**Critical Signs (Immediate Action):**
- No emails processed for 2+ hours
- Dashboard completely inaccessible
- All scenarios showing errors
- Database connection failed
- API endpoints returning 500

---

## Escalation Path

### Level 1: Frontline Resolution (0-15 mins)

**Handle These Issues:**
- Individual email not classified
- Wrong category (manual fix)
- Dashboard not loading (refresh/browser issue)
- Known issues with documented fixes

**Actions:**
- Follow troubleshooting steps above
- Check service status pages
- Apply quick fixes from this guide

---

### Level 2: System Issues (15-60 mins)

**Handle These Issues:**
- Multiple emails not processing
- Make.com scenario errors
- API endpoint failures
- Database connection issues

**Actions:**
- Check Vercel logs for errors
- Review Make.com scenario history
- Test API endpoints manually
- Apply code fixes if identified
- Escalate to Level 3 if unresolved

---

### Level 3: Critical System Failure (1+ hours)

**Handle These Issues:**
- Complete system outage
- Data corruption
- Security incidents
- Unknown/undiagnosed issues

**Actions:**
- Notify system admin immediately
- Notify team lead
- Document all symptoms and actions taken
- Prepare incident report
- Coordinate emergency fix

**Emergency Contacts:**
- System Admin: [Contact details]
- Vercel Support: https://vercel.com/support
- Make.com Support: https://www.make.com/en/support/
- Neon Support: https://neon.tech/support

---

### External Service Status

**Check These First During Outages:**
- Vercel: https://www.vercel-status.com
- Make.com: https://status.make.com
- Neon: https://status.neon.tech
- Claude API: https://status.anthropic.com

---

## Emergency Procedures

### Complete System Outage

**Symptoms:**
- Dashboard inaccessible
- All API endpoints returning 500
- Make.com scenarios completely failing

**Immediate Actions:**

1. **Assess Scope (2 mins)**
   - Can you access dashboard?
   - Are any API endpoints responding?
   - Is Make.com accessible?
   - Check service status pages

2. **Check Recent Changes (5 mins)**
   - Any recent Vercel deployments?
   - Any code changes pushed?
   - Any environment variable changes?
   - Check git log for recent commits

3. **Rollback If Needed (10 mins)**
   - Go to Vercel dashboard
   - Find last known good deployment
   - Click "Promote to Production"
   - Verify system recovers

4. **Escalate (15 mins)**
   - If unresolved after 15 mins, escalate to Level 3
   - Notify system admin
   - Document all symptoms

5. **Communicate (Ongoing)**
   - Update team on status
   - Estimate recovery time
   - Document incident report

---

### Database Corruption

**Symptoms:**
- Query returns inconsistent data
- Missing records
- Constraint violations

**Immediate Actions:**

1. **Stop All Writes (Immediate)**
   - Turn off Make.com scenarios
   - Stop any manual operations
   - Prevent further damage

2. **Assess Damage (5 mins)**
   - Check affected tables
   - Identify corrupted records
   - Determine data loss scope

3. **Restore Backup (30 mins)**
   - Access Neon console
   - Select backup point
   - Initiate restore
   - Verify data integrity

4. **Review & Prevent**
   - Identify root cause
   - Add safeguards
   - Update procedures

---

### Security Incident

**Symptoms:**
- Unauthorised access
- Data breach suspected
- Malicious activity detected

**Immediate Actions:**

1. **Contain (Immediate)**
   - Turn off all Make.com scenarios
   - Revoke API keys
   - Change passwords
   - Disable user accounts

2. **Assess (15 mins)**
   - Determine breach scope
   - Identify compromised data
   - Check audit logs

3. **Notify (Immediate)**
   - Notify system admin
   - Notify CTO
   - Document incident

4. **Recover (As directed)**
   - Restore from clean backup
   - Reset all credentials
   - Patch vulnerabilities
   - Monitor for recurrence

---

## Appendix: Quick Commands Reference

### Database Operations

```bash
# Open Drizzle Studio
npx drizzle-kit studio

# Generate migrations
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Vercel Operations

```bash
# View deployment logs
vercel logs

# Deploy to production
vercel --prod

# Rollback to previous deployment
vercel rollback

# View environment variables
vercel env ls
```

### Testing API Endpoints

```bash
# Health check
curl https://sagitine-hud.vercel.app/api/health

# Test classification
curl https://sagitine-hud.vercel.app/api/classify -X POST \
  -H "Content-Type: application/json" \
  -d '{"from_email":"test@example.com","subject":"Test","body_plain":"Test","timestamp":"2026-04-02T10:30:00Z"}'

# Test send status
curl "https://sagitine-hud.vercel.app/api/tickets-send-status?id=<msg-id>" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"sent_at":"2026-04-02T10:30:00Z"}'
```

---

## Document Maintenance

**Version History:**
- v1.0 (2 April 2026) - Initial release

**Next Review Date:** 1 May 2026

**Feedback:**
If you encounter an issue not covered in this guide, please document it and suggest additions to the troubleshooting procedures.

---

**Related Documentation:**
- [Operations Runbook](./Sagitine-Operations-Runbook.md) - Daily procedures
- [Architecture Guide](../SAGITINE_ARCHITECTURE.md) - System design
- [Design System](../GEMINI.md) - Frontend guidelines
- [Deployment Guide](../GEMINI_DEPLOY.md) - Production setup
