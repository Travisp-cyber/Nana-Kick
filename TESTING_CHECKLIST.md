# 🧪 Testing Checklist for Access Pass Integration

## After Deployment Completes

### ✅ Step 1: Verify Deployment Success
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Check that the deployment succeeded (green checkmark)
3. Look for any build errors in the deployment logs

---

### ✅ Step 2: Test Admin Access (You)

**Expected Behavior:** As an admin, you should have full access without needing an access pass.

1. **Open your app through Whop:**
   - Go to your Whop admin dashboard
   - Navigate to your Nana Kick app
   - Click on an experience page

2. **Check the Upload Button:**
   - ✅ Should show "Admin" (not "Sign in" or "Members only")
   - ✅ Upload button should work without restrictions

3. **Upload and Edit an Image:**
   - ✅ Upload an image successfully
   - ✅ Click "Edit" and provide instructions
   - ✅ Image should process WITHOUT "Members only" error
   - ✅ Check Vercel logs for: `👑 Admin user detected - granting access:`

---

### ✅ Step 3: Test Non-Admin User WITHOUT Access Pass

**Expected Behavior:** Users without an access pass should be blocked from premium features.

**You'll need to test this with a different Whop account (not your admin account):**

1. **Create a test Whop account** (or use incognito mode)
2. **Open your Nana Kick app** through Whop (don't purchase an access pass yet)
3. **Try to upload an image:**
   - ✅ Should show "Sign in" or "Members only" on the upload button
4. **Try to edit an image:**
   - ❌ Should get error: "Premium feature"
   - ✅ Should see option to redirect to `/plans` page
   - ✅ Check Vercel logs for: `❌ User does not have required access pass:`

---

### ✅ Step 4: Test User WITH Access Pass (Paid User)

**Expected Behavior:** Users who purchase an access pass should have full access.

**Using your test account:**

1. **Purchase an access pass:**
   - Click "Upgrade to Starter" (or any tier) on `/plans` page
   - Complete the checkout (you can use Whop test mode)
   
2. **Return to the app:**
   - ✅ Should show "Member" (not "Sign in")
   - ✅ Upload button should work
   
3. **Upload and edit an image:**
   - ✅ Upload should work
   - ✅ Edit should process successfully
   - ✅ Check Vercel logs for: `✅ User has access via pass: pass_XXXXXXXX`

---

### ✅ Step 5: Check Vercel Logs

Go to Vercel Dashboard → Your Project → Logs → Runtime Logs

**Look for these log messages:**

#### Admin User:
```
👑 Admin user detected - granting access: user_XXXXXXXX
```

#### User with Access Pass:
```
✅ User has access via pass: pass_XXXXXXXX
✅ User verified with access pass: user_YYYYYYYY
```

#### User without Access Pass:
```
❌ User does not have required access pass: user_ZZZZZZZ
```

---

### ✅ Step 6: Verify Environment Variables in Vercel

Double-check all environment variables are set correctly:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify these are ALL present:

**Required:**
- ✅ `NEXT_PUBLIC_ACCESS_PASS_STARTER_ID`
- ✅ `NEXT_PUBLIC_ACCESS_PASS_CREATOR_ID`
- ✅ `NEXT_PUBLIC_ACCESS_PASS_PRO_ID`
- ✅ `NEXT_PUBLIC_ACCESS_PASS_BRAND_ID`
- ✅ `NEXT_PUBLIC_WHOP_PLAN_STARTER_ID`
- ✅ `NEXT_PUBLIC_WHOP_PLAN_CREATOR_ID`
- ✅ `NEXT_PUBLIC_WHOP_PLAN_PRO_ID`
- ✅ `NEXT_PUBLIC_WHOP_PLAN_BRAND_ID`
- ✅ `ADMIN_WHOP_USER_IDS`
- ✅ `NEXT_PUBLIC_WHOP_APP_ID`
- ✅ `WHOP_API_KEY`
- ✅ `NEXT_PUBLIC_WHOP_COMPANY_ID`
- ✅ `GOOGLE_AI_API_KEY`

---

## 🐛 Troubleshooting

### Issue: "Property 'access' does not exist on type 'WhopServerSdk'"

**Fix:** Check Whop SDK version. You need `@whop/api` v1.0.0 or higher.

```bash
pnpm list @whop/api
# If outdated:
pnpm update @whop/api
```

---

### Issue: Admin still gets "Members only" error

**Possible causes:**
1. `ADMIN_WHOP_USER_IDS` doesn't include your Whop user ID
2. Environment variables not applied in Vercel (redeploy)
3. Check Vercel logs to see what user ID is being detected

**Fix:**
```bash
# In Vercel, verify:
ADMIN_WHOP_USER_IDS="user_veTxkgdFxEcRW"  # Your actual user ID

# Or add multiple admins:
ADMIN_WHOP_USER_IDS="user_veTxkgdFxEcRW,user_tpT8rH4IQk1dn"
```

---

### Issue: "Whop user token not found" error

**Possible causes:**
1. Not accessing app through Whop iframe
2. Whop dev proxy not enabled

**Fix:**
- Always access your app through: `https://whop.com/dashboard/developer` → Your App → Preview
- Never access directly via Vercel URL in production mode

---

### Issue: Access pass check not working

**Possible causes:**
1. Access Pass IDs are incorrect (typo)
2. Access Pass IDs start with wrong prefix (should be `pass_`)

**Fix:**
1. Go to Whop Dashboard → Your App → Access Passes
2. Click on each access pass
3. Copy the ID (format: `pass_XXXXXXXX`)
4. Update in Vercel Environment Variables
5. Redeploy

---

## 📊 Expected Flow

### For Admin Users:
```
1. User opens app → Whop verifies token
2. App checks if user ID in ADMIN_WHOP_USER_IDS
3. ✅ Admin detected → Full access granted
4. Can upload/edit without restrictions
```

### For Paid Users (with access pass):
```
1. User opens app → Whop verifies token
2. App checks if user is admin → No
3. App checks access passes using whopSdk.access.checkIfUserHasAccessToAccessPass()
4. ✅ Has valid access pass → Access granted
5. Can upload/edit images
```

### For Non-Paid Users (no access pass):
```
1. User opens app → Whop verifies token
2. App checks if user is admin → No
3. App checks access passes → None found
4. ❌ Access denied → Redirect to /plans
5. User must purchase to use premium features
```

---

## ✅ All Tests Passed?

If all tests pass:
- ✅ Admin can access everything
- ✅ Paid users can access everything
- ✅ Non-paid users are redirected to upgrade
- ✅ Logs show correct user identification

**Your access pass integration is working! 🎉**

---

## 📝 Next Steps

1. **Test with real customers** (use Whop test mode first)
2. **Monitor Vercel logs** for any access issues
3. **Set up Whop webhooks** to sync membership changes
4. **Add usage limits** per tier (optional)
5. **Create analytics dashboard** (optional)

---

## 🆘 Need Help?

Check these files:
- `ENVIRONMENT_VARIABLES_GUIDE.md` - Environment variable setup
- `README.md` - General setup and configuration
- Vercel Logs - Runtime errors and user flow
- Whop Dashboard Logs - Webhook events and user actions

