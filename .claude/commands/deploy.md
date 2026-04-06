# /deploy — Sagitine HUD Production Deploy

Run the full deploy checklist for the Sagitine HUD. Catches problems before they hit production.

## Steps — run in order, stop and report if any step fails

### 1. TypeScript build check
```bash
cd sagitine-hud && npm run build
```
If this fails, show the TypeScript errors and stop. Do not deploy broken code.

### 2. Verify critical env vars are set in Vercel
```bash
cd sagitine-hud && vercel env ls
```
Check that ALL of these are present in the output:
- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_SENDER_EMAIL`

If any are missing, show which ones and stop. Tell the user to add them via `vercel env add <NAME> production`.

### 3. Deploy to production
```bash
cd sagitine-hud && vercel --prod --yes
```

### 4. Confirm and commit
After a successful deploy:
- Show the deployment URL
- Run `git status` to check for uncommitted changes
- If there are staged or modified files, ask the user if they want to commit them before closing out

## Output format
Report each step clearly:
```
✅ Build passed
✅ All 6 env vars confirmed in Vercel
✅ Deployed → https://sagitine-hud.vercel.app
⚠️  3 modified files not committed — commit now?
```

If anything fails, show the exact error and stop cleanly.
