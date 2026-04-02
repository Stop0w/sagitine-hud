# Sagitine Email Triage System - Operations Runbook

> **Last Updated:** 2 April 2026  
> **System Version:** 1.0.0  
> **Status:** Live Production

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Daily Operations](#daily-operations)
3. [Monitoring & Health Checks](#monitoring-health-checks)
4. [Issue Management](#issue-management)
5. [Runbook Procedures](#runbook-procedures)

---

## System Overview

### Purpose
The Sagitine Email Triage System automates customer service email classification and response drafting using AI. This allows human agents to focus on reviewing and personalising responses rather than manual triage.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    MAKE.COM AUTOMATION                 │
├─────────────────────────────────────────────────────────┤
│  Scenario 1: Inbound Triage 💁                              │
│  ├─ Watch: Inbox (unread emails)                             │
│  ├─ API Call: /api/classify                                 │
│  ├─ Action: Create draft + move to "02_AI Drafted" folder       │
│                                                             │
│  Scenario 2: Approval & Send 📩                               │
│  ├─ Watch: Sent Items                                         │
│  ├─ Action: Extract EMAIL_ID + mark ticket as "sent"            │
│  └─ Action: Move to "03_Sent" folder (optional)              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    NEON DATABASE                     │
│  ├─ inbound_emails (raw email data)                          │
│  ├─ triage_results (AI classification + draft)                  │
│  ├─ tickets (workflow state)                                   │
│  └─ customer_profiles (customer history)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    SAGITINE HUD DASHBOARD             │
│  ├─ Ticket queue (all classified emails)                     │
│  ├─ Resolution console (review/edit/send)                      │
│  └─ Metrics dashboard                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Daily Operations

### Morning Checklist (Start of Shift)

**Step 1: System Health Check**
```
1. Check Sagitine HUD dashboard loads
2. Verify Make.com scenarios are active:
   - Scenario 1: "Inbound Triage 💁" - should show ON
   - Scenario 2: "Approval & Send 📩" - should show ON
3. Check for any overnight errors in Make.com scenario logs
4. Verify database connection (check recent emails are visible)
```

**Step 2: Queue Review**
```
1. Check "02_AI Drafted" folder in Outlook
2. Review any drafts that were created overnight
3. Prioritise by urgency level:
   - Urgency 8-10: Handle immediately
   - Urgency 5-7: Handle within 2 hours
   - Urgency 2-4: Handle by end of day
```

**Step 3: Manual Handling Queue
```
1. Check "06_Manual Handling" folder in Outlook
2. Review emails that need human attention:
   - Partnership inquiries
   - Praise/UGC
   - Uncategorized items
3. Process or route as appropriate
```

### Operational Procedures

#### Processing AI-Drafted Emails

**Location:** "Inbox/02_AI Drafted" folder

**Procedure:**

1. **Open Draft Email**
   - Double-click to open in Outlook
   - Review the AI-generated response

2. **Quality Check**
   - Is the tone appropriate?
   - Is the factual information correct?
   - Are any specific details missing?

3. **Edit if Needed**
   - Personalise the response
   - Add specific details (order numbers, dates, etc.)
   - Adjust tone if required

4. **Send Response**
   - Click Send when satisfied
   - Email moves to "Sent Items" automatically
   - **Scenario 2 will automatically mark the ticket as "sent"**

#### Handling Spam

**Location:** "Inbox/07_Ignored" folder

**Procedure:**
- Review periodically (weekly) to ensure no legitimate emails were misclassified
- If found: Move back to Inbox and reprocess

#### Manual Review Queue

**Location:** "Inbox/06_Manual Handling" folder

**Categories:**
- Partnership/wholesale inquiries
- Praise/testimonials
- Uncategorized items
- API failures

**Procedure:**
1. Investigate original inquiry
2. Determine appropriate action
3. Draft response manually
4. Send response
5. Move to appropriate folder after processing

---

## Monitoring & Health Checks

### Key Metrics to Monitor

**Daily:**
- Total incoming emails
- Classification accuracy (spot check)
- Average response time
- Queue depth at end of day

**Weekly:**
- Category distribution trends
- Customer satisfaction scores
- System uptime

### Health Check Indicators

**Scenario 1 (Inbound Triage):**
- ✅ Status: Should always be ON
- ⚠️ Warning: If processing backlog > 20 emails
- ❌ Critical: If no emails processed for 2+ hours

**Scenario 2 (Approval & Send):**
- ✅ Status: Should always be ON
- ⚠️ Warning: If sent emails not marked as "sent"
- ❌ Critical: If database update failures > 5/hour

### Health Check Commands

**Check Make.com Scenario Status:**
```
1. Log in to Make.com
2. Open each scenario
3. Check for error indicators (red modules)
4. Review scenario logs (clock icon)
```

**Check Database Connection:**
```
1. Open Sagitine HUD dashboard
2. Verify ticket queue loads
3. Check recent tickets are visible
```

---

## Issue Management

### Common Issues & Solutions

#### Issue 1: Email Not Classified

**Symptoms:**
- Email sits in Inbox, never moves
- No draft created in "02_AI Drafted"

**Troubleshooting:**
1. Check Scenario 1 is ON in Make.com
2. Check `/api/classify` endpoint is responding:
   ```bash
   curl https://sagitine-hud.vercel.app/api/classify -X POST \
   -H "Content-Type: application/json" \
   -d '{"from_email":"test@example.com","subject":"Test","body_plain":"Test"}'
   ```
3. Check Vercel deployment logs

**Resolution:**
- If Make.com error: Fix module configuration
- If API error: Check Vercel logs
- If no error: Check email filters in Outlook

---

#### Issue 2: Draft Created with Wrong Category

**Symptoms:**
- Email moves to wrong subfolder
- Classification is incorrect

**Troubleshooting:**
1. Review email content in `/api/classify` response
2. Check keyword classification logic in classify.ts
3. Verify training data examples

**Resolution:**
- Update classification logic in `api/classify.ts`
- Redeploy Vercel application
- Test with similar email

---

#### Issue 3: Sent Email Not Marked as "Sent"

**Symptoms:**
- Email sent but ticket status remains "classified"
- Database `send_status` field stays "not_applicable"

**Troubleshooting:**
1. Check sent email body contains `<!--EMAIL_ID:xxx-->` (view source)
2. Check Scenario 2 is running
3. Check `/api/tickets-send-status` endpoint is accessible
4. Check database logs for errors

**Resolution:**
- If EMAIL_ID missing: Check Scenario 1 Module 5 body content
- If Scenario 2 not running: Turn on Scenario 2
- If API returns 404: Check database join logic
- If API returns 500: Check Vercel logs

---

#### Issue 4: Duplicate Emails Processed

**Symptoms:**
- Same email appears multiple times in queue
- Multiple drafts created for same email

**Cause:**
Make.com webhook triggered multiple times

**Troubleshooting:**
1. Check `/api/classify` uses `onConflictDoNothing()` on sourceMessageId
2. Verify idempotency is working

**Resolution:**
- Check API endpoint for idempotency bugs
- Add additional deduplication if needed

---

## Runbook Procedures

### Procedure: Releasing System Updates

**Pre-Deployment:**
1. Run tests in development environment
2. Backup database
3. Notify team of maintenance window

**Deployment Steps:**
1. Deploy to Vercel (automatic via Git integration)
2. Verify API health check responds
3. Test with sample email
4. Monitor first 5 classifications for accuracy

**Post-Deployment:**
1. Monitor error logs for 1 hour
2. Check Make.com scenarios still active
3. Verify dashboard loads correctly
4. Document any issues

---

### Procedure: Handling System Outage

**Detection:**
- Dashboard fails to load
- Make.com scenarios show errors
- API endpoints returning 500

**Immediate Actions:**
1. Check Vercel status page
2. Check Make.com service status
3. Notify team of outage

**Escalation Path:**
1. **Level 1:** System unavailable > 15 mins → Notify team lead
2. **Level 2:** Critical system failure > 1 hour → Notify CTO
3. **Level 3:** Production data corruption → Notify all stakeholders

---

### Procedure: Customer Data Request

**For Legal/Compliance:**
1. Export customer data from database
2. Provide requested information
3. Document request and response

**For Support:**
1. Check data access permissions
2. Retrieve specific customer records
3. Share only requested information

---

### Procedure: System Shutdown

**Planned Shutdown:**
1. Turn off Make.com scenarios
2. Stop Vercel deployment
3. Notify stakeholders
4. Document downtime

**Emergency Shutdown:**
1. Turn off Make.com scenarios immediately
2. Stop Vercel deployment
3. Document incident and resolution

---

## Appendix

### Quick Reference

**Make.com Scenarios:**
- Scenario 1: "Sagitine Service - Inbound Triage 💁"
- Scenario 2: "Sagitine Service - Approval & Send 📩"

**API Endpoints:**
- POST `/api/classify` - Classify email and generate draft
- POST `/api/tickets-send-status?id=` - Mark ticket as sent
- GET `/api/metrics` - Dashboard metrics

**Key Folders:**
- Inbox/02_AI Drafted - AI-generated drafts awaiting review
- Inbox/03_Sent - Sent responses
- Inbox/06_Manual Handling - Needs human attention
- Inbox/07_Ignored - Spam/auto-filtered

**Emergency Contacts:**
- System Admin: [Contact details]
- Vercel Support: https://vercel.com/support
- Make.com Support: https://www.make.com/en/support/

---

**Runbook Version:** 1.0
**Last Reviewed:** 2 April 2026
**Next Review Date:** 1 May 2026
