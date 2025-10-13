# Free Trial Feature - Database Setup

## SQL Commands for Supabase

Run these commands in your Supabase SQL Editor to add the free trial columns:

```sql
-- Add free trial tracking columns to the User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "freeTrialUsed" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasClaimedFreeTrial" BOOLEAN NOT NULL DEFAULT FALSE;
```

## What This Does

- `freeTrialUsed`: Tracks remaining free generations (starts at 10 for new users)
- `hasClaimedFreeTrial`: One-time flag to prevent re-claiming free trial

## Free Trial Implementation Summary

### Features
1. **10 Free Generations**: New users get 10 free AI image edits before purchasing
2. **One-Time Trial**: Users can only claim the free trial once
3. **Carryover**: Remaining free generations carry over when users upgrade (e.g., 5 free + 50 plan = 55 total)
4. **Smart Blocking**: After exhausting free trial, users get a clear upgrade message
5. **Admin Bypass**: Admin users skip the free trial system entirely

### Usage Priority
When a user edits an image, the system deducts usage in this order:
1. **Free trial first** (if `freeTrialUsed > 0`)
2. **Plan limit** (if within subscription limit)
3. **Overage** (charges apply if over limit)

### User Experience
- **Free trial active**: UI shows "Free Trial: X remaining" with blue/purple progress bar
- **Free trial low** (≤3 remaining): Warning message to upgrade
- **Free trial exhausted**: Clear message: "You used all of your free credits. To keep editing, upgrade to one of our plans."
- **After purchase**: Remaining free credits stack with plan limit

### Files Modified
1. `prisma/schema.prisma` - Added free trial fields
2. `src/lib/whop-usage.ts` - Access check + usage tracking logic
3. `src/app/api/process-image/route.ts` - Block when exhausted
4. `src/components/UsageStatus.tsx` - Display free trial status
5. `src/app/plans/page.tsx` - Show free trial messaging

## Testing Checklist

Once deployed, test the following:

- [ ] New user gets 10 free generations automatically
- [ ] Use 5 generations → verify 5 remain in UI
- [ ] Purchase Starter plan → verify 5 free + 50 plan = 55 total available
- [ ] New user uses all 10 free → gets blocked with upgrade message
- [ ] Blocked user cannot upload/edit new images
- [ ] Admin user bypasses free trial entirely
- [ ] Free trial banner shows on /plans page when active
- [ ] Overage pricing still works correctly for paid users

## Deployment Steps

1. ✅ Run SQL commands above in Supabase SQL Editor
2. ✅ Commit and push code to GitHub
3. ✅ Vercel will auto-deploy
4. ✅ Test the free trial flow

