# Launch Guide - Nana Kick

This guide will walk you through the final steps to test and launch your app for public users.

## Prerequisites Checklist

✅ All items below should already be completed:

- [x] Supabase database created with all tables
- [x] `.env.local` configured with all environment variables
- [x] All environment variables added to Vercel
- [x] Whop app configured with webhook URL
- [x] App deployed to Vercel
- [x] Access Passes created in Whop (4 tiers)
- [x] Plan IDs configured

## New Feature: Monthly Usage Reset (Just Added!)

### What It Does
Automatically resets user generation limits on the 1st of each month at midnight UTC.

### Setup Required

1. **Generate a CRON_SECRET**
   
   Run this command to generate a secure random secret:
   ```bash
   openssl rand -base64 32
   ```

2. **Add CRON_SECRET to Environment Variables**

   **Local (`.env.local`):**
   ```bash
   CRON_SECRET="your_generated_secret_here"
   ```

   **Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add new variable:
     - Name: `CRON_SECRET`
     - Value: `your_generated_secret_here`
     - Environments: Production, Preview, Development

3. **Deploy to Vercel**
   
   The cron job is configured in `vercel.json` and will be automatically set up on deployment.
   ```bash
   git add .
   git commit -m "Add monthly usage reset cron job"
   git push
   ```

### Testing the Cron Endpoint

Test manually before relying on the scheduled job:

```bash
# Replace with your actual values
curl -X GET https://your-app.vercel.app/api/cron/reset-usage \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Usage reset completed successfully",
  "usersReset": 2,
  "nextResetDate": "2025-11-01T00:00:00.000Z",
  "timestamp": "2025-10-12T10:30:00.000Z",
  "details": [
    {
      "whopUserId": "user_xxxxx",
      "previousUsage": 45,
      "tier": "creator"
    }
  ]
}
```

### Vercel Cron Job Configuration

The cron job is configured in `vercel.json`:
- **Path:** `/api/cron/reset-usage`
- **Schedule:** `0 0 1 * *` (midnight on the 1st of each month, UTC)

You can view cron job logs in:
- Vercel Dashboard → Your Project → Logs → Filter by `/api/cron`

---

## Phase 1: Complete User Flow Testing

### Test 1: User Purchase Flow

1. **Create a Test Account**
   - Use a different Whop account (or incognito mode)
   - Make sure it's NOT in your `ADMIN_WHOP_USER_IDS` list

2. **Purchase an Access Pass**
   - Go to your Whop app page
   - Purchase the "Starter" plan (cheapest for testing)
   - Complete the checkout

3. **Verify Webhook Received**
   - Go to Vercel Dashboard → Your Project → Logs
   - Filter for `/api/webhooks`
   - Look for log entry with purchase event
   - Should see: `[Whop Webhook] Received:` with event details

4. **Check Database**
   - Go to Supabase Dashboard → Table Editor → `User` table
   - Find your test user (search by email or whopUserId)
   - Verify fields:
     - `currentTier` = "starter"
     - `generationsUsed` = 0
     - `generationsLimit` = 50
     - `usageResetDate` = (next month)

### Test 2: Access Verification & Image Editing

1. **Login with Test User**
   - Access your app through Whop iframe
   - Should show "Member" or tier name in usage status

2. **Upload and Edit an Image**
   - Upload a test image
   - Enter editing instructions (e.g., "make it brighter")
   - Click "Submit Instructions"
   - Wait for processing (may take 10-30 seconds)

3. **Verify Success**
   - Edited image should display
   - Usage status should update (e.g., "49/50 remaining")
   - Check Vercel logs for success messages:
     ```
     ✅ User verified - starter tier (49 remaining): user_xxxxx
     📊 Usage incremented for user: user_xxxxx
     ```

4. **Check Database Again**
   - Supabase → `User` table → Your test user
   - `generationsUsed` should now be 1

### Test 3: Usage Limit Enforcement

1. **Manually Set User to Limit**
   - In Supabase, edit your test user
   - Set `generationsUsed` = 50 (same as `generationsLimit`)
   - Save

2. **Try to Edit Another Image**
   - Should get error: "You've used all 50 generations for this month"
   - Should show option to upgrade
   - Verify in Vercel logs: `❌ User exceeded limit:`

### Test 4: Admin Access

1. **Login with Your Admin Account**
   - Use account listed in `ADMIN_WHOP_USER_IDS`
   - Should show "Admin" in usage status

2. **Verify Unlimited Access**
   - Upload and edit multiple images
   - Should work without limit checks
   - Vercel logs should show: `👑 Admin user - unlimited access:`

### Test 5: Monthly Usage Reset

1. **Manually Trigger Reset**
   ```bash
   curl -X GET https://your-app.vercel.app/api/cron/reset-usage \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

2. **Verify Reset**
   - Check response JSON (should show users reset)
   - Check Supabase → Users with used generations should be reset to 0
   - Check `usageResetDate` updated to next month

3. **Test User Can Edit Again**
   - Login with test user who was at limit
   - Should now be able to edit images again

---

## Phase 2: Health Check Verification

### Test the Health Endpoint

```bash
curl https://your-app.vercel.app/api/health
```

**Expected Response (200 OK):**
```json
{
  "timestamp": "2025-10-12T10:30:00.000Z",
  "status": "healthy",
  "services": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful"
    },
    "googleAI": {
      "status": "healthy",
      "message": "Google AI API key configured"
    },
    "whopAPI": {
      "status": "healthy",
      "message": "Whop API fully configured"
    },
    "environment": {
      "status": "healthy",
      "message": "Environment: production"
    }
  }
}
```

**If Unhealthy (503):**
- Check which service is failing
- Verify environment variables are set correctly in Vercel
- Fix issues and redeploy

---

## Phase 3: Pre-Launch Verification

### Checklist

- [ ] All 5 user flow tests passed
- [ ] Health check returns 200 OK
- [ ] CRON_SECRET added to Vercel environment variables
- [ ] Cron endpoint tested manually and works
- [ ] Vercel logs show no errors
- [ ] Supabase database contains test data
- [ ] Admin access works
- [ ] Non-admin users are properly gated

### Environment Variables Double-Check

Go to Vercel Dashboard → Settings → Environment Variables and verify ALL of these exist:

**Database:**
- [ ] `DATABASE_URL`
- [ ] `DIRECT_URL`

**Google AI:**
- [ ] `GOOGLE_AI_API_KEY`

**Whop Core:**
- [ ] `WHOP_API_KEY`
- [ ] `WHOP_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_WHOP_APP_ID`
- [ ] `NEXT_PUBLIC_WHOP_COMPANY_ID`
- [ ] `NEXT_PUBLIC_WHOP_AGENT_USER_ID`

**Admin:**
- [ ] `ADMIN_WHOP_USER_IDS`

**Access Passes (Critical!):**
- [ ] `NEXT_PUBLIC_ACCESS_PASS_STARTER_ID`
- [ ] `NEXT_PUBLIC_ACCESS_PASS_CREATOR_ID`
- [ ] `NEXT_PUBLIC_ACCESS_PASS_PRO_ID`
- [ ] `NEXT_PUBLIC_ACCESS_PASS_BRAND_ID`

**Plan IDs:**
- [ ] `NEXT_PUBLIC_WHOP_PLAN_STARTER_ID`
- [ ] `NEXT_PUBLIC_WHOP_PLAN_CREATOR_ID`
- [ ] `NEXT_PUBLIC_WHOP_PLAN_PRO_ID`
- [ ] `NEXT_PUBLIC_WHOP_PLAN_BRAND_ID`

**Cron (New!):**
- [ ] `CRON_SECRET`

---

## Phase 4: Launch!

### Step 1: Switch to Production Mode

1. **Whop Dashboard**
   - Go to Whop Developer Dashboard
   - Select your "Nana Kick" app
   - Switch from "Development" to "Production" mode

2. **Test Again in Production**
   - Run through the purchase flow one more time
   - Verify everything still works

### Step 2: Publish Your App

**Option A: Public Listing (Whop Marketplace)**
1. Go to Whop Developer Dashboard
2. Select your app
3. Click "Submit for Review" or "Publish"
4. Fill out marketplace listing details:
   - App name: "Nana Kick"
   - Description: "AI-powered image editing with natural language"
   - Screenshots (take from your testing)
   - Pricing tiers (already configured)
5. Submit and wait for approval

**Option B: Direct Links**
If you don't want marketplace listing yet:
1. Share your Whop app installation link directly
2. Format: `https://whop.com/app/[YOUR_APP_ID]`
3. Users can install from this link

### Step 3: Monitor Launch

**First 24 Hours:**
1. **Watch Vercel Logs**
   - Go to Vercel Dashboard → Logs
   - Filter by time: Last 24 hours
   - Look for errors or warnings

2. **Monitor Supabase**
   - Check User table for new registrations
   - Verify usage tracking is working
   - Check for any database errors

3. **Check Webhook Events**
   - Whop Dashboard → Webhooks
   - Verify events are being received
   - Check for any failed deliveries

4. **Test with First Real User**
   - Ask a friend or beta user to try the app
   - Walk through the process with them
   - Fix any issues immediately

### Step 4: Post-Launch Setup

**Set Up Monitoring:**
- Bookmark Vercel logs page
- Check health endpoint daily: `https://your-app.vercel.app/api/health`
- Monitor Supabase dashboard for database health

**User Support:**
- Be available for first users
- Have your Vercel and Supabase dashboards ready
- Keep your testing documentation handy

**Next Month:**
- Verify cron job runs successfully on the 1st
- Check Vercel cron logs
- Verify users' limits were reset

---

## Troubleshooting

### Cron Job Not Running

**Check:**
1. Vercel Dashboard → Settings → Crons
2. Verify cron is listed and enabled
3. Check Vercel logs on the 1st of the month
4. Manually trigger to test: `curl -X GET https://your-app.vercel.app/api/cron/reset-usage -H "Authorization: Bearer YOUR_CRON_SECRET"`

### Webhook Not Received

**Check:**
1. Whop Dashboard → Webhooks → Deliveries
2. Look for failed deliveries
3. Verify webhook URL is correct in Whop settings
4. Check `WHOP_WEBHOOK_SECRET` matches between Whop and Vercel

### User Can't Edit Images

**Check:**
1. Verify user has an access pass (Whop Dashboard)
2. Check Vercel logs for specific error
3. Verify `NEXT_PUBLIC_ACCESS_PASS_*` IDs are correct
4. Test admin account to isolate issue

### Database Connection Failed

**Check:**
1. Supabase project is active (not paused)
2. `DATABASE_URL` and `DIRECT_URL` are correct
3. Run health check: `/api/health`
4. Check Vercel logs for database errors

---

## Success Metrics

After launch, track these metrics:

**Week 1:**
- Number of installs
- Number of purchases per tier
- Average usage per user
- Error rate (aim for <1%)

**Month 1:**
- Monthly Recurring Revenue (MRR)
- Churn rate
- Most popular tier
- Average images edited per user
- Cron job success (usage resets)

---

## Optional Future Enhancements

After successful launch, consider adding:

1. **Rate Limiting** - Prevent API abuse
2. **Overage Billing** - Allow users to pay for extra generations
3. **Analytics Dashboard** - Show users their usage history
4. **Batch Processing** - Edit multiple images at once
5. **Email Notifications** - Alert users when approaching limit
6. **Usage Reports** - Send monthly summaries
7. **More AI Models** - Offer different editing styles

---

## Support

If you encounter issues during launch:

1. **Check the logs:**
   - Vercel: Dashboard → Logs
   - Supabase: Dashboard → Logs
   - Whop: Dashboard → Webhooks → Deliveries

2. **Use health check:**
   - `curl https://your-app.vercel.app/api/health`

3. **Review documentation:**
   - `TESTING_CHECKLIST.md`
   - `ENVIRONMENT_VARIABLES_GUIDE.md`
   - `WHOP_INTEGRATION_GUIDE.md`

---

**You're ready to launch! 🚀**

Follow the phases above in order, and you'll have a production-ready app serving real users.

