# Sagitine AI CX Agent - Deployment Guide

**Status:** Ready for Vercel deployment
**Repository:** https://github.com/Stop0w/sagitine-hud
**Last Updated:** 2026-04-01

---

## QUICK DEPLOY (Recommended)

### 1. Deploy to Vercel

1. Go to https://vercel.com/new
2. Import the GitHub repository: `Stop0w/sagitine-hud`
3. Vercel will auto-detect the framework
4. Click **Deploy**

### 2. Configure Environment Variables in Vercel

After deployment, add these environment variables in Vercel Dashboard:

**Required:**
```
DATABASE_URL=postgresql://neondb_owner:npg_DcMVKN6u4lTx@ep-dawn-lake-a7mgk9ex-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
ANTHROPIC_API_KEY=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
```

**Optional:**
```
NODE_ENV=production
ENABLE_AUTO_SEND=false
ENABLE_VECTOR_SEARCH=false
```

### 3. Run Database Migration

```bash
npx tsx migrations/add-management-escalation-fields.ts up
```

---

## PUBLIC ENDPOINTS (After Deployment)

Once deployed, your endpoints will be:

```
https://sagitine-hud.vercel.app/api/classify
https://sagitine-hud.vercel.app/api/tickets/{id}/sent
https://sagitine-hud.vercel.app/api/tickets/{id}/failed
https://sagitine-hud.vercel.app/api/hub/ticket/{id}
https://sagitine-hud.vercel.app/api/metrics
https://sagitine-hud.vercel.app/api/health
```

---

## MAKE.COM INTEGRATION

### Module 2: HTTP / Make a Request → classify

**URL:**
```
https://sagitine-hud.vercel.app/api/classify
```

**Method:** POST

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "from_email": "customer@example.com",
  "from_name": "Customer Name",
  "subject": "Email subject line",
  "body_plain": "Plain text email body",
  "body_html": "<html>HTML email body</html>",
  "timestamp": "2026-04-01T10:00:00.000Z",
  "message_id": "unique-message-id",
  "thread_id": "thread-id-if-available"
}
```

**Expected Response:**
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
    "safe_to_auto_send": false
  },
  "timestamp": "2026-04-01T10:00:00.000Z"
}
```

---

## VALIDATION

### 1. Health Check

```bash
curl https://sagitine-hud.vercel.app/api/health
```

Expected:
```json
{
  "status": "ok",
  "service": "sagitine-ai-cx-agent",
  "version": "1.0.0",
  "timestamp": "2026-04-01T10:00:00.000Z"
}
```

### 2. Classify Test

```bash
curl -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "test@example.com",
    "subject": "Box arrived damaged",
    "body_plain": "Hi, my order arrived damaged",
    "timestamp": "2026-04-01T10:00:00.000Z"
  }'
```

---

## ARCHITECTURE

**Deployment Type:** Single Vercel app (frontend + serverless API)

**Why:**
- Simpler to maintain
- Single dashboard
- Automatic HTTPS
- Zero-config deployments
- Built-in CI/CD

**Structure:**
```
/ → Static React HUD (Vite build)
/api/* → Serverless API routes (Hono)
```

---

## ENVIRONMENT VARIABLES REFERENCE

### Required for API/Runtime

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection | `postgresql://...` |
| `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet access | `sk-ant-api03-...` |

### Optional but Recommended

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | Environment | `production` |
| `ENABLE_AUTO_SEND` | Allow auto-sending drafts | `false` |
| `ENABLE_VECTOR_SEARCH` | Enable RAG search | `false` |

### Not Required for MVP

| Variable | Purpose | Notes |
|----------|---------|-------|
| `MICROSOFT_CLIENT_ID` | Outlook integration | Phase 3 |
| `MICROSOFT_CLIENT_SECRET` | Outlook integration | Phase 3 |
| `MICROSOFT_TENANT_ID` | Outlook integration | Phase 3 |

---

## DEPLOYMENT STATUS

- [x] Git repository ready
- [x] GitHub connected (https://github.com/Stop0w/sagitine-hud)
- [x] Code committed
- [x] Vercel configuration created
- [ ] Deployed to Vercel (requires your action)
- [ ] Environment variables configured (requires your action)
- [ ] Database migration run (requires your action)
- [ ] Endpoints validated (requires deployment)

---

## NEXT STEPS

1. **Deploy to Vercel**
   - Go to https://vercel.com/new
   - Import `Stop0w/sagitine-hud`
   - Click Deploy

2. **Configure Environment Variables**
   - Add DATABASE_URL
   - Add ANTHROPIC_API_KEY

3. **Run Database Migration**
   - SSH into deployed environment or run locally
   - Execute migration script

4. **Test Endpoints**
   - Health check
   - Classify endpoint
   - Hub hydration

5. **Configure Make.com**
   - Use production URL in Make modules
   - Test email classification flow

---

## TROUBLESHOOTING

### Deployment fails
- Check Vercel build logs
- Verify all dependencies are in package.json
- Ensure TypeScript compiles without errors

### API returns 500 errors
- Verify environment variables are set in Vercel
- Check database connection
- Verify API key is valid

### Health check passes but classify fails
- Check Anthropic API key
- Verify database migration ran
- Check API logs in Vercel dashboard

---

## SUPPORT

For issues or questions:
- GitHub: https://github.com/Stop0w/sagitine-hud/issues
- Vercel Dashboard: Check deployment logs
- Neon Console: Check database connection
