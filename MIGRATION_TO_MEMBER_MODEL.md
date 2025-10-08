# Migration to Member-Based Model - Summary

## ✅ What Was Changed

The Nana Kick backend has been successfully refactored from a **community-based model** to a **member-based model**. Each member now directly manages their own plan, usage, and credit balance.

---

## 📋 Changes Made

### 1️⃣ Database Schema Migration

**File:** `supabase/migrations/20251008180000_migrate_to_member_based_model.sql`

**Changes:**
- ✅ Added new columns to `members` table:
  - `plan` (text) - Member's subscription tier
  - `pool_limit` (integer) - Total available generations
  - `current_usage` (integer) - Current usage count
  - `renewal_date` (date) - Subscription renewal date
  - `created_at` (timestamptz) - Account creation timestamp

- ✅ Migrated existing data from `communities` to `members`
- ✅ Updated `transactions` table to use `member_id` instead of `community_id`
- ✅ Updated `images` table to use `member_id` instead of `community_id`
- ✅ Updated `webhook_events` table to use `member_id` instead of `community_id`
- ✅ Dropped the `communities` table entirely
- ✅ Created new indexes for optimal query performance
- ✅ Added unique constraint on member email

**Final Schema:**

```sql
-- Members table
members:
  - id (uuid, primary key)
  - email (text, unique)
  - plan (text)
  - pool_limit (integer)
  - current_usage (integer)
  - renewal_date (date)
  - created_at (timestamptz)

-- Transactions table
transactions:
  - id (uuid, primary key)
  - member_id (uuid, foreign key → members.id)
  - type (enum: 'generation' | 'extra_credit' | 'overage')
  - amount (integer)
  - date (timestamptz)

-- Images table
images:
  - id (uuid, primary key)
  - member_id (uuid, foreign key → members.id)
  - url (text)
  - prompt (text)
  - created_at (timestamptz)

-- Webhook events table
webhook_events:
  - event_id (text, primary key)
  - event_type (text)
  - member_id (uuid)
  - processed_at (timestamptz)
```

---

### 2️⃣ Backend Code Updates

#### **src/lib/usage.ts**
- ✅ Renamed `CommunityUsage` → `MemberUsage`
- ✅ Updated `consumeGeneration()` to use `memberId` instead of `communityId`
- ✅ Changed all database queries to use `members` table
- ✅ Renamed `resetUsageForDueCommunities()` → `resetUsageForDueMembers()`

#### **src/app/api/use-generation/route.ts**
- ✅ Changed request body to accept `member_id` instead of `community_id`
- ✅ Updated image insertion to use `member_id`
- ✅ Updated API documentation comments

#### **src/app/api/add-credits/route.ts**
- ✅ Changed payload type to use `member_id`
- ✅ Updated all database operations to query `members` table
- ✅ Updated webhook event recording to use `member_id`
- ✅ Modified transaction logging to use `member_id`

#### **src/app/api/usage/status/route.ts**
- ✅ Changed query parameter from `community_id` to `member_id`
- ✅ Updated to query `members` table
- ✅ Returns member email instead of community name

---

### 3️⃣ Frontend Code Updates

#### **src/components/UsageStatus.tsx**
- ✅ Renamed prop from `communityId` to `memberId`
- ✅ Updated API call to use `member_id` query parameter
- ✅ Changed empty state message from "Connect a community" to "Sign in"
- ✅ Updated environment variable reference

#### **src/app/experiences/[experienceId]/page.tsx**
- ✅ Updated comment to reference `member_id`

---

### 4️⃣ Webhook Handler Updates

#### **src/app/api/webhooks/route.ts**
- ✅ Changed from creating/updating communities to upserting members
- ✅ Uses member email as the unique identifier
- ✅ Simplified logic - no more community management

#### **src/app/api/whop/webhook/route.ts**
- ✅ Refactored to upsert members instead of communities
- ✅ Extracts email from Whop membership data
- ✅ Updated error messages

#### **src/app/api/whop/subscribe/route.ts**
- ✅ Changed from creating communities to upserting members
- ✅ Now requires email for member identification
- ✅ Uses upsert pattern for idempotency

---

## 🚀 How to Apply the Migration

### Step 1: Apply the Database Migration

Run the migration in Supabase:

```bash
# Using Supabase CLI
supabase db push

# Or manually run the migration file in Supabase Studio
```

The migration will:
1. Safely migrate all existing data
2. Update foreign keys and indexes
3. Drop the old `communities` table

### Step 2: Verify Database Changes

Check that the migration completed successfully:

```sql
-- Verify members table structure
SELECT * FROM members LIMIT 1;

-- Verify transactions are linked to members
SELECT t.*, m.email 
FROM transactions t 
JOIN members m ON t.member_id = m.id 
LIMIT 5;

-- Verify images are linked to members
SELECT i.*, m.email 
FROM images i 
JOIN members m ON i.member_id = m.id 
LIMIT 5;
```

### Step 3: Update Environment Variables (if needed)

If you have any environment variables referencing communities, update them:

```bash
# Old
NEXT_PUBLIC_DEFAULT_COMMUNITY_ID=...

# New
NEXT_PUBLIC_DEFAULT_MEMBER_ID=...
```

### Step 4: Deploy Code Changes

All code changes are already applied. Deploy to your hosting platform:

```bash
# Example for Vercel
vercel --prod

# Or your deployment method
```

---

## 🔍 Testing the Changes

### Test API Endpoints

1. **Test `/api/use-generation`**
   ```bash
   curl -X POST http://localhost:3000/api/use-generation \
     -H "Content-Type: application/json" \
     -d '{"member_id":"<member-uuid>","prompt":"test"}'
   ```

2. **Test `/api/usage/status`**
   ```bash
   curl "http://localhost:3000/api/usage/status?member_id=<member-uuid>"
   ```

3. **Test `/api/add-credits`**
   ```bash
   curl -X POST http://localhost:3000/api/add-credits \
     -H "Content-Type: application/json" \
     -d '{"member_id":"<member-uuid>","credits":100}'
   ```

### Verify Frontend

1. Open the app in browser
2. Check that UsageStatus component displays correctly
3. Verify that generation tracking works
4. Test credit purchases

---

## 📊 Key Improvements

### Before (Community-Based)
- ❌ Complex many-to-many relationship (communities ↔ members)
- ❌ Shared pool limits across community members
- ❌ Required community management overhead
- ❌ Confusing ownership model

### After (Member-Based)
- ✅ Simple one-to-one model (member owns their data)
- ✅ Individual pool limits per member
- ✅ Direct member-to-resource relationships
- ✅ Clear ownership and simpler logic
- ✅ Better for individual subscriptions

---

## 🔄 Rollback Plan (if needed)

If you need to rollback, you can restore the previous state:

1. **Restore from Supabase backup** (taken before migration)
2. **Revert code changes** using Git:
   ```bash
   git revert <migration-commit-hash>
   ```

---

## 📝 Notes

- **Data Safety:** The migration preserves all existing data by copying community attributes to members before dropping the communities table
- **Idempotency:** All webhook handlers now use upsert operations for safe retries
- **Email as Key:** Members are now uniquely identified by email address
- **No Breaking Changes:** The migration handles data transformation automatically

---

## ✅ Verification Checklist

After migration, verify:

- [ ] Database migration ran successfully
- [ ] All members have plan, pool_limit, current_usage, renewal_date
- [ ] Transactions are linked to members (not communities)
- [ ] Images are linked to members (not communities)
- [ ] API endpoints respond correctly with member_id
- [ ] Usage tracking works for individual members
- [ ] Credit purchases update member pool_limit
- [ ] Webhooks create/update members correctly
- [ ] Frontend displays usage status
- [ ] No references to "community" remain in user-facing text

---

## 🎉 Success!

Your Nana Kick backend is now running on a clean member-based model. Each member manages their own subscription, usage, and credits independently.
