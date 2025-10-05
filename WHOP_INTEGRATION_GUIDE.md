# Whop Payment Integration Guide

## Overview

This guide explains how the Whop payment integration works in your Next.js app. The integration allows you to:
- Track user subscriptions
- Manage payment events through webhooks
- Gate content based on subscription status
- Sync user data with Whop

## Setup Requirements

### Environment Variables

Add these to your `.env.local` file:

```env
# Database
DATABASE_URL="your-postgresql-connection-string"

# Whop API Keys
NEXT_PUBLIC_WHOP_APP_ID="your-whop-app-id"
WHOP_API_KEY="your-whop-api-key"
WHOP_WEBHOOK_SECRET="your-webhook-secret"

# Optional
NEXT_PUBLIC_WHOP_AGENT_USER_ID="your-agent-user-id"
NEXT_PUBLIC_WHOP_COMPANY_ID="your-company-id"
NEXT_PUBLIC_WHOP_PRODUCT_URL="your-whop-product-url"
```

### Database Setup

1. Initialize Prisma and create database:
```bash
npx prisma generate
npx prisma db push
```

2. For production, use migrations:
```bash
npx prisma migrate dev --name init
npx prisma migrate deploy
```

## Architecture

### Database Schema

- **User**: Stores Whop user information
- **Company**: Stores company/seller information
- **Product**: Your products on Whop
- **Plan**: Pricing plans for products
- **Membership**: User's membership status
- **Subscription**: Individual product subscriptions
- **Payment**: Payment history
- **AccessLog**: Tracks access attempts

### Key Components

1. **Webhook Handler** (`/api/webhooks`)
   - Processes Whop events
   - Updates subscription status
   - Tracks payments

2. **Authentication** (`/lib/auth.ts`)
   - Session management
   - Subscription verification
   - User syncing

3. **API Endpoints**
   - `/api/subscription/status` - Check subscription status
   - `/api/subscription/sync` - Sync user data
   - `/api/subscription/check-access` - Verify access to resources

## Implementation Guide

### 1. Protecting Pages/Features

```typescript
// In a server component
import { hasActiveSubscription, getWhopSession } from '@/lib/auth';

export default async function PremiumPage() {
  const session = await getWhopSession();
  
  if (!session || !await hasActiveSubscription(session.userId)) {
    redirect('/upgrade');
  }
  
  // Render premium content
}
```

### 2. Client-Side Subscription Check

```typescript
// Create a hook
import { useState, useEffect } from 'react';

export function useSubscription() {
  const [status, setStatus] = useState<{
    loading: boolean;
    hasSubscription: boolean;
    membership: any;
  }>({ loading: true, hasSubscription: false, membership: null });

  useEffect(() => {
    fetch('/api/subscription/status')
      .then(res => res.json())
      .then(data => {
        setStatus({
          loading: false,
          hasSubscription: data.hasActiveSubscription,
          membership: data.membership,
        });
      });
  }, []);

  return status;
}
```

### 3. Gating Content

```typescript
// SubscriptionGate component
import { useSubscription } from '@/hooks/useSubscription';

export function SubscriptionGate({ children, fallback }: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { loading, hasSubscription } = useSubscription();
  
  if (loading) return <div>Loading...</div>;
  if (!hasSubscription) return fallback || <UpgradePrompt />;
  
  return <>{children}</>;
}
```

### 4. Checking Feature Access

```typescript
async function checkAccess(resource: string) {
  const response = await fetch('/api/subscription/check-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource }),
  });
  
  const data = await response.json();
  return data.allowed;
}
```

## Webhook Configuration

1. In your Whop dashboard, set the webhook URL to:
   ```
   https://your-app.vercel.app/api/webhooks
   ```

2. Subscribe to these events:
   - `app.installed`
   - `app.uninstalled`
   - `membership.went_valid`
   - `membership.went_invalid`
   - `payment.completed`
   - `payment.failed`

## Security Best Practices

1. **Always verify webhooks** in production using the signature
2. **Use server-side checks** for sensitive operations
3. **Log access attempts** for security auditing
4. **Sync data periodically** to ensure accuracy
5. **Handle edge cases** like expired sessions

## Testing

1. Use Whop's test mode for development
2. Test webhook handling with tools like ngrok
3. Verify subscription states transition correctly
4. Test edge cases (expired subscriptions, failed payments)

## Monitoring

- Check `AccessLog` table for unauthorized access attempts
- Monitor webhook failures in your logs
- Set up alerts for payment failures
- Track subscription churn through the database

## Next Steps

1. Create user dashboard UI components
2. Add subscription management features
3. Implement upgrade/downgrade flows
4. Add analytics tracking
5. Set up email notifications

## Support

For Whop-specific issues:
- [Whop Documentation](https://docs.whop.com)
- [Whop Developer Dashboard](https://whop.com/developers)

For implementation issues:
- Check the webhook logs
- Verify environment variables
- Ensure database is properly migrated