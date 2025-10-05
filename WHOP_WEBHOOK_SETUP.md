# Whop Webhook Setup Guide

This guide will walk you through setting up webhooks to receive payment and subscription events from Whop.

## Prerequisites

- Your app must be deployed to a public URL (e.g., Vercel, Railway, etc.)
- You need access to your Whop Developer Dashboard

## Step 1: Deploy Your App

First, make sure your app is deployed and the webhook endpoint is accessible:

```bash
# If using Vercel
vercel --prod

# Your webhook URL will be:
# https://your-app.vercel.app/api/webhooks
```

## Step 2: Configure Webhooks in Whop Dashboard

1. Go to [Whop Developer Dashboard](https://whop.com/dashboard/developer)
2. Navigate to your app settings
3. Find the "Webhooks" section
4. Click "Add Webhook Endpoint"

### Webhook Configuration

**Webhook URL:** 
```
https://your-app.vercel.app/api/webhooks
```
(Replace with your actual deployed URL)

**Events to Subscribe:**
- ✅ `app.installed` - When someone installs your app
- ✅ `app.uninstalled` - When someone uninstalls your app
- ✅ `membership.went_valid` - When a membership becomes active
- ✅ `membership.went_invalid` - When a membership expires/cancels
- ✅ `payment.completed` - When a payment succeeds
- ✅ `payment.failed` - When a payment fails

## Step 3: Get Your Webhook Secret

After creating the webhook:
1. Whop will provide you with a webhook secret
2. Copy this secret
3. Update your `.env.local` file:

```env
WHOP_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

## Step 4: Test Your Webhook

### For Development (using ngrok)

If you want to test webhooks locally:

1. Install ngrok:
```bash
brew install ngrok  # macOS
# or download from https://ngrok.com
```

2. Start your Next.js app locally:
```bash
npm run dev
```

3. In another terminal, expose your local server:
```bash
ngrok http 3000
```

4. Use the ngrok URL for your webhook:
```
https://xxxxx.ngrok.io/api/webhooks
```

### Test Events

In the Whop dashboard, you can send test webhook events:
1. Go to your webhook settings
2. Click "Send test event"
3. Select an event type
4. Check your app logs to verify receipt

## Step 5: Verify Webhook Implementation

Your webhook handler (`/api/webhooks/route.ts`) includes:
- ✅ Signature verification (security)
- ✅ Event processing for all subscription events
- ✅ Database updates for user/membership status
- ✅ Error handling and logging

## Common Issues & Solutions

### Webhook not receiving events
- Check that your URL is publicly accessible
- Verify the webhook is active in Whop dashboard
- Check your app logs for errors

### Signature verification failing
- Ensure `WHOP_WEBHOOK_SECRET` is set correctly
- Make sure you're using the raw request body for verification
- Check that the secret hasn't been regenerated

### Database errors
- Verify your database connection is working
- Check that all tables have been created
- Look for foreign key constraint errors in logs

## Testing Webhook Flows

### Test Membership Creation
1. Have a test user purchase your product on Whop
2. Watch for `membership.went_valid` webhook
3. Verify user is created in database
4. Check membership status is set to "valid"

### Test Membership Cancellation
1. Cancel the test subscription in Whop
2. Watch for `membership.went_invalid` webhook
3. Verify membership status updates to "invalid"
4. Check that related subscriptions are canceled

## Monitoring Webhooks

### Check webhook logs in your database:
```sql
-- View recent webhook activity
SELECT * FROM "AccessLog" 
WHERE resource LIKE 'webhook_%' 
ORDER BY "createdAt" DESC 
LIMIT 20;

-- Check failed webhooks
SELECT * FROM "AccessLog" 
WHERE resource LIKE 'webhook_%' 
AND allowed = false 
ORDER BY "createdAt" DESC;
```

### Add logging to track webhook events:
The webhook handler already logs events to console. You can view these in:
- Vercel: Function logs in dashboard
- Local: Terminal output

## Security Best Practices

1. **Always verify webhook signatures** in production
2. **Use HTTPS** for your webhook endpoint
3. **Implement idempotency** - handle duplicate events gracefully
4. **Set up alerts** for webhook failures
5. **Regularly rotate** your webhook secret

## Next Steps

After setting up webhooks:
1. Monitor initial webhook events
2. Verify data is syncing correctly
3. Set up error notifications
4. Implement retry logic for failed operations
5. Add webhook event analytics

## Support

- [Whop Webhook Documentation](https://docs.whop.com/webhooks)
- [Whop API Reference](https://docs.whop.com/api)
- Check webhook status in your Whop dashboard
- View webhook logs in your app's deployment platform