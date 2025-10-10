# Environment Variables Configuration Guide

## Required Environment Variables for Nana Kick

This guide explains all the environment variables needed for your Nana Kick app to work properly with Whop access passes.

---

## 📋 Complete Variable List

Add these to your `.env.local` file (for local development) and to Vercel Environment Variables (for production).

### 🗄️ Database Configuration

```bash
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
DIRECT_URL="postgresql://user:password@host:port/database"
```

### 🤖 Google AI Configuration

```bash
GOOGLE_AI_API_KEY="your_google_ai_api_key"
```

### 🔐 Whop App Configuration

```bash
# Your Whop App ID (from Whop Developer Dashboard)
NEXT_PUBLIC_WHOP_APP_ID="app_XXXXXXXX"

# Your Whop API Key (KEEP SECRET!)
WHOP_API_KEY="whop_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# Your Whop Webhook Secret
WHOP_WEBHOOK_SECRET="whop_webhook_XXXXXXXXXXXXXXXXXXXXXXXX"

# Your Whop Company ID
NEXT_PUBLIC_WHOP_COMPANY_ID="biz_XXXXXXXX"

# Your Whop Agent User ID (optional)
NEXT_PUBLIC_WHOP_AGENT_USER_ID="user_XXXXXXXX"
```

### 👑 Admin Configuration

```bash
# Comma-separated list of admin Whop User IDs
ADMIN_WHOP_USER_IDS="user_XXXXXXXX,user_YYYYYYYY"
```

### 🎟️ **Whop Access Pass IDs** (CRITICAL - for feature gating)

These are what the app checks to see if a user has paid for access.

```bash
# Get these from: Whop Dashboard > Your App > Access Passes > [Click on a pass] > Copy ID

NEXT_PUBLIC_ACCESS_PASS_STARTER_ID="pass_XXXXXXXX"
NEXT_PUBLIC_ACCESS_PASS_CREATOR_ID="pass_XXXXXXXX"
NEXT_PUBLIC_ACCESS_PASS_PRO_ID="pass_XXXXXXXX"
NEXT_PUBLIC_ACCESS_PASS_BRAND_ID="pass_XXXXXXXX"
```

**How to find these:**
1. Go to [Whop Developer Dashboard](https://whop.com/dashboard/developer)
2. Click on your "Nana Kick" app
3. Click on "Access Passes" in the sidebar
4. Click on each pass (Starter Pack, Creator Pack, etc.)
5. Copy the Access Pass ID (starts with `pass_`)

### 💳 **Whop Plan IDs** (for checkout)

These are used when users click "Upgrade" to purchase access.

```bash
# Get these from: Whop Dashboard > Your App > Access Passes > [Select Pass] > Plans tab

NEXT_PUBLIC_WHOP_PLAN_STARTER_ID="plan_FZU9vah2czqqj"   # $9/month
NEXT_PUBLIC_WHOP_PLAN_CREATOR_ID="plan_aKqigTdeYP0dU"  # $29/month
NEXT_PUBLIC_WHOP_PLAN_PRO_ID="plan_L3rV1nOkgvNVN"      # $99/month
NEXT_PUBLIC_WHOP_PLAN_BRAND_ID="plan_XzJlssOnPaWx6"    # $69/month
```

**You already have these! ✅**

### 🔗 Checkout URLs (optional fallback)

```bash
NEXT_PUBLIC_WHOP_CHECKOUT_STARTER_URL="https://whop.com/checkout/..."
NEXT_PUBLIC_WHOP_CHECKOUT_CREATOR_URL="https://whop.com/checkout/..."
NEXT_PUBLIC_WHOP_CHECKOUT_PRO_URL="https://whop.com/checkout/..."
NEXT_PUBLIC_WHOP_CHECKOUT_BRAND_URL="https://whop.com/checkout/..."
```

---

## 🚨 What You MUST Add to .env.local

Based on the code updates, you **must** add these Access Pass IDs to your `.env.local`:

```bash
NEXT_PUBLIC_ACCESS_PASS_STARTER_ID="pass_XXXXXXXX"
NEXT_PUBLIC_ACCESS_PASS_CREATOR_ID="pass_XXXXXXXX"
NEXT_PUBLIC_ACCESS_PASS_PRO_ID="pass_XXXXXXXX"
NEXT_PUBLIC_ACCESS_PASS_BRAND_ID="pass_XXXXXXXX"
```

---

## 🔍 How to Get Your Access Pass IDs

### Step-by-Step:

1. **Open Whop Dashboard**  
   Go to https://whop.com/dashboard/developer

2. **Select Your App**  
   Click on "Nana Kick" (or your app name)

3. **Navigate to Access Passes**  
   In the left sidebar, click "Access Passes"

4. **Copy Each Pass ID**  
   For each access pass:
   - Click on it (e.g., "Starter Pack")
   - Look for the Access Pass ID (format: `pass_XXXXXXXX`)
   - Copy it
   - Add to your `.env.local`

5. **Example**  
   If your Starter Pack Access Pass ID is `pass_ABC123XYZ`, add:
   ```bash
   NEXT_PUBLIC_ACCESS_PASS_STARTER_ID="pass_ABC123XYZ"
   ```

---

## ✅ Verification Checklist

After adding the variables, verify:

- [ ] All 4 Access Pass IDs are in `.env.local`
- [ ] All 4 Plan IDs are in `.env.local` (you already have these)
- [ ] Restart your dev server: `npm run dev`
- [ ] Test admin access (you should see "Admin" instead of "Sign in")
- [ ] Test image editing (should work without "Members only" error)

---

## 🚀 For Deployment (Vercel)

1. Go to Vercel Dashboard
2. Select your "Nana Kick" project
3. Go to Settings > Environment Variables
4. Add ALL the same variables from `.env.local`
5. Redeploy

---

## 📝 Quick Reference: Access Pass vs Plan ID

| Purpose | Variable Type | Example | Usage |
|---------|---------------|---------|-------|
| **Check if user has access** | Access Pass ID | `pass_ABC123` | Used in `/api/process-image` to verify user paid |
| **Redirect user to purchase** | Plan ID | `plan_XYZ789` | Used in `/plans` page when user clicks "Upgrade" |

**You need BOTH for each tier!**

---

## 🆘 Troubleshooting

### "Premium feature" error even though I'm admin
- Check: `ADMIN_WHOP_USER_IDS` includes your Whop user ID
- Check: `NEXT_PUBLIC_WHOP_AGENT_USER_ID` is set to your user ID

### "Members only" banner on upload
- Check: All Access Pass IDs are set in `.env.local`
- Check: You restarted the dev server after adding variables

### Deployment failed
- Check: All variables are added to Vercel Environment Variables
- Check: No typos in variable names (must match exactly)

---

## 📚 Additional Resources

- [Whop Developer Docs](https://docs.whop.com/apps)
- [Access Pass Documentation](https://docs.whop.com/apps/access-passes)
- [Whop SDK Reference](https://docs.whop.com/api)

