# Overage Pricing Implementation Guide

## Overview

Overage pricing has been successfully implemented! Users can now continue editing images beyond their plan limits by paying per-generation. This matches the plan descriptions on your `/plans` page.

---

## ✅ What Was Implemented

### 1. Database Schema Updates
**File:** `prisma/schema.prisma`

Added three new fields to the `User` model:
- `overageUsed` (Int) - Tracks extra generations beyond limit
- `overageCharges` (Float) - Accumulated charges in dollars
- `lastBillingDate` (DateTime) - When overage was last billed

### 2. Usage Tracking Logic
**File:** `src/lib/whop-usage.ts`

Updated to handle overage automatically:
- `getUserTierAndUsage()` - Now returns overage information
- `incrementUsage()` - Smart logic:
  - If `generationsUsed < limit` → increment normal usage
  - If `generationsUsed >= limit` → increment overage and charge

**Overage Pricing Per Tier:**
- Starter ($9/mo): $0.10 per extra generation
- Creator ($29/mo): $0.08 per extra generation
- Brand ($69/mo): $0.06 per extra generation
- Pro ($99/mo): $0.05 per extra generation

### 3. Removed Hard Limit Block
**File:** `src/app/api/process-image/route.ts`

- **Before:** Blocked users at their limit with error 429
- **Now:** Allows continued processing, charges overage automatically
- Logs overage usage for monitoring

### 4. Updated UI
**File:** `src/components/UsageStatus.tsx`

Shows clear overage status:
- Normal: "47/50 remaining"
- At limit: "50/50 used" + warning about overage cost
- In overage: "50/50 + 3 extra ($0.30)"

### 5. Billing Management
**File:** `src/lib/whop-billing.ts`

Comprehensive billing functions:
- `getUsersWithPendingOverage()` - Find users who need billing
- `getOverageBillingSummary()` - Get aggregate stats
- `exportOverageBillingCSV()` - Export for manual billing
- `markOverageAsBilled()` - Reset after billing
- `resetAllOverage()` - Monthly reset with billing

### 6. Automated Monthly Reset
**File:** `src/app/api/cron/reset-usage/route.ts`

Enhanced to handle overage:
1. Logs all pending overage charges
2. Resets both normal usage AND overage
3. Updates `lastBillingDate`
4. Returns billing summary in response

### 7. Admin Dashboard
**File:** `src/app/api/admin/overage-billing/route.ts`

Admin endpoints:
- `GET /api/admin/overage-billing` - View billing summary
- `GET /api/admin/overage-billing?export=csv` - Export CSV
- `GET /api/admin/overage-billing?user=USER_ID` - View specific user
- `POST /api/admin/overage-billing` - Mark user as billed

---

## 🚀 Next Steps - Deploy & Test

### Step 1: Deploy Database Changes

The database schema was updated. You need to apply the migration:

```bash
# Generate Prisma client with new fields
npx prisma generate

# Push schema changes to database
npx prisma db push
```

**OR if you prefer migrations:**
```bash
npx prisma migrate dev --name add_overage_tracking
npx prisma migrate deploy
```

### Step 2: Deploy to Vercel

```bash
git add .
git commit -m "Implement overage pricing system"
git push
```

Vercel will automatically:
- Run `prisma generate` (via postinstall)
- Build and deploy your app
- The cron job will continue running daily

### Step 3: Verify Deployment

**Test the health check:**
```bash
curl https://nana-kick.vercel.app/api/health
```

Should return 200 OK with all services healthy.

**Test the cron endpoint:**
```bash
curl -X GET https://nana-kick.vercel.app/api/cron/reset-usage \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Should return success with overage billing info.

---

## 📊 How It Works

### User Flow Example

**Scenario:** User has Starter plan (50 generations/month, $0.10 per extra)

1. **Generations 1-50:** Normal usage
   - UI shows: "30/50 remaining"
   - Database: `generationsUsed` increments
   
2. **Generation 51 (First overage):**
   - UI shows: "50/50 + 1 extra ($0.10)"
   - Database: `overageUsed = 1`, `overageCharges = 0.10`
   - Logs: `📊 Overage usage incremented: +$0.10`

3. **Generation 52-60:** Continues in overage
   - UI shows: "50/50 + 10 extra ($1.00)"
   - Database: `overageUsed = 10`, `overageCharges = 1.00`

4. **End of Month (Reset Date):**
   - Cron job runs → logs overage for billing
   - Admin manually bills $1.00 via Whop dashboard
   - Database resets: `generationsUsed = 0`, `overageUsed = 0`, `overageCharges = 0`

---

## 💼 Billing Process (Manual)

Since Whop doesn't have automated usage-based billing API (yet), you'll bill overage charges manually:

### Monthly Billing Workflow

**1. Check Cron Logs (1st of each month)**

After the cron job runs, check Vercel logs:
```
[CRON] Processing overage billing...
[CRON] Users with pending overage charges:
  - user_ABC123 (user@email.com): $5.60 for 56 extra gens
  - user_XYZ789 (user2@email.com): $2.40 for 24 extra gens
[CRON] Reset overage for 2 users. Total to bill: $8.00
```

**2. Export Billing Data**

Call the admin API:
```bash
curl https://nana-kick.vercel.app/api/admin/overage-billing?export=csv
```

This gives you a CSV with:
- Whop User ID
- Email
- Name
- Tier
- Overage Generations
- Overage Charges (USD)

**3. Bill via Whop Dashboard**

For each user with overage:
1. Go to Whop Dashboard → Users → Find user
2. Create manual charge/invoice for overage amount
3. Description: "Overage: X extra generations"

**4. Mark as Billed (Optional)**

If you want to track billing status:
```bash
curl -X POST https://nana-kick.vercel.app/api/admin/overage-billing \
  -H "Content-Type: application/json" \
  -d '{"whopUserId": "user_ABC123"}'
```

---

## 🔍 Admin Monitoring

### View Billing Summary

```bash
curl https://nana-kick.vercel.app/api/admin/overage-billing
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalUsers": 15,
    "totalRevenue": 45.80,
    "totalGenerations": 512,
    "averageCharge": 3.05,
    "byTier": {
      "starter": {
        "count": 8,
        "totalCharges": 20.40,
        "totalGenerations": 204
      },
      "creator": {
        "count": 5,
        "totalCharges": 18.40,
        "totalGenerations": 230
      },
      "brand": {
        "count": 2,
        "totalCharges": 7.00,
        "totalGenerations": 78
      }
    },
    "users": [...]
  }
}
```

### View Specific User

```bash
curl https://nana-kick.vercel.app/api/admin/overage-billing?user=user_ABC123
```

---

## ⚙️ Configuration

### Overage Pricing

Defined in `src/lib/subscription/plans.ts`:

```typescript
export const PLAN_OVERAGE_CENTS: Record<PlanTier, number> = {
  starter: 10,  // $0.10/gen
  creator: 8,   // $0.08/gen
  brand: 6,     // $0.06/gen
  pro: 5,       // $0.05/gen
  admin: 0,     // $0.00/gen (unlimited)
}
```

To change pricing, update these values and redeploy.

### Overage Limits

Currently: **Unlimited overage** (trust-based billing)

To add a cap (e.g., max 2x plan limit):
```typescript
// In incrementUsage() function
const maxOverage = user.generationsLimit; // Cap at 2x total
if (user.overageUsed >= maxOverage) {
  return false; // Block further usage
}
```

---

## 🧪 Testing

### Test Normal Usage
1. Create/use test account
2. Edit images (track usage status)
3. Verify counter increments

### Test Overage
1. Manually set user to limit in database:
   ```sql
   UPDATE "User" 
   SET "generationsUsed" = "generationsLimit" 
   WHERE "whopUserId" = 'user_TEST123';
   ```
2. Edit another image
3. Verify:
   - Processing succeeds (not blocked)
   - UI shows overage
   - Database has `overageUsed = 1`, `overageCharges = 0.10` (or your tier's rate)

### Test Monthly Reset
1. Call cron endpoint manually
2. Check logs for billing summary
3. Verify database reset

---

## 📈 Monitoring

### Key Metrics to Track

- **Daily:** Check overage usage trends
- **Weekly:** Review which tiers use overage most
- **Monthly:** Total overage revenue
- **Alerts:** Users with unusually high overage

### Vercel Logs

Search for these log patterns:
- `📊 Overage usage incremented` - New overage generation
- `[CRON] Processing overage billing` - Monthly billing run
- `⚠️ User in overage` - User at limit continuing to use

---

## 🔮 Future Enhancements

### Automated Billing (If Whop Adds API Support)

If Whop releases usage-based billing API:

```typescript
// In whop-billing.ts
export async function autoChargeOverage(whopUserId: string, membershipId: string) {
  await whopSdk.billing.createUsage({
    membershipId: membershipId,
    amount: Math.round(user.overageCharges * 100), // cents
    description: `Overage: ${user.overageUsed} extra generations`,
    quantity: user.overageUsed
  });
}
```

### Real-time Billing

Instead of monthly, charge immediately:
```typescript
// After each overage generation
await whopSdk.billing.createCharge({...});
```

### Overage Notifications

Email users when they:
- Reach 80% of limit
- Enter overage
- Accumulate $X in overage charges

---

## ❓ FAQ

**Q: What happens if user cancels subscription with pending overage?**
A: Overage charges are logged before reset. Bill them before cancellation or write off the charges.

**Q: Can users see their overage charges?**
A: Yes, in the UsageStatus component. You could also add a detailed usage page.

**Q: How do I handle refunds?**
A: Manually adjust in database:
```sql
UPDATE "User" 
SET "overageUsed" = 0, "overageCharges" = 0 
WHERE "whopUserId" = 'user_XXX';
```

**Q: What if I want to disable overage and go back to hard limits?**
A: In `process-image/route.ts`, restore the hard block (return error 429 when at limit).

---

## 🎉 Summary

Overage pricing is now live! Users can continue using your service beyond plan limits, and you'll collect additional revenue. The system:

✅ Tracks overage usage automatically  
✅ Calculates tier-based charges  
✅ Shows clear UI feedback  
✅ Logs billing data monthly  
✅ Provides admin tools for management  
✅ Resets automatically each month  

**Next:** Deploy to Vercel, test the flow, and monitor your first month of overage revenue!

---

## 📞 Support

If you encounter issues:
1. Check Vercel logs for errors
2. Verify database schema was updated (`prisma db push`)
3. Test with `curl` commands above
4. Check `OVERAGE_PRICING_IMPLEMENTATION.md` (this file)

For questions about the implementation, refer to the code comments in each modified file.

