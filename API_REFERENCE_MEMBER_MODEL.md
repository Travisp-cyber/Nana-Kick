# API Reference - Member-Based Model

## Overview

All API endpoints now use `member_id` instead of `community_id` for identifying users and tracking their usage.

---

## 🔥 Core Endpoints

### 1. Use Generation

**Endpoint:** `POST /api/use-generation`

**Purpose:** Consume one generation credit and track usage for a member.

**Request Body:**
```json
{
  "member_id": "uuid-string",
  "prompt": "optional prompt text",
  "data": {}  // optional additional data
}
```

**Success Response (200):**
```json
{
  "success": true,
  "remaining": 95,
  "url": "https://example.com/output.png"
}
```

**Error Responses:**
- `400` - Missing or invalid member_id
- `402` - Monthly limit exceeded
- `404` - Member not found
- `500` - Server error

**Example:**
```bash
curl -X POST https://your-app.com/api/use-generation \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "123e4567-e89b-12d3-a456-426614174000",
    "prompt": "A banana doing a kick flip"
  }'
```

---

### 2. Get Usage Status

**Endpoint:** `GET /api/usage/status`

**Purpose:** Fetch current usage stats for a member.

**Query Parameters:**
- `member_id` (required) - UUID of the member

**Success Response (200):**
```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "plan": "pro",
  "pool_limit": 1000,
  "current_usage": 150,
  "remaining": 850,
  "overage_cents": 0
}
```

**Error Responses:**
- `400` - Missing member_id
- `404` - Member not found

**Example:**
```bash
curl "https://your-app.com/api/usage/status?member_id=123e4567-e89b-12d3-a456-426614174000"
```

---

### 3. Add Credits

**Endpoint:** `POST /api/add-credits`

**Purpose:** Add extra credits to a member's pool limit (typically called by webhooks).

**Request Body:**
```json
{
  "member_id": "uuid-string",
  "credits": 100,
  "event_id": "optional-idempotency-key"
}
```

**Success Response (200):**
```json
{
  "ok": true
}
```

**Error Responses:**
- `400` - Missing member_id or invalid credits amount
- `404` - Member not found
- `500` - Database error

**Allowed Credit Amounts:** 100, 500, 1000

**Example:**
```bash
curl -X POST https://your-app.com/api/add-credits \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "123e4567-e89b-12d3-a456-426614174000",
    "credits": 500,
    "event_id": "whop:payment_abc123"
  }'
```

---

## 🔗 Webhook Endpoints

### 4. General Webhook Handler

**Endpoint:** `POST /api/webhooks`

**Purpose:** Handle various webhook events from payment providers (Whop).

**Expected Payload:**
```json
{
  "event": "payment.succeeded",
  "membership_id": "whop-membership-id",
  "email": "user@example.com",
  "plan": {
    "name": "Pro Plan"
  }
}
```

**Behavior:**
- Creates or updates member based on email
- Updates plan, pool_limit, and renewal_date
- Idempotent (safe to retry)

---

### 5. Whop Subscribe

**Endpoint:** `POST /api/whop/subscribe`

**Purpose:** Handle new subscription creation after Whop checkout.

**Request Body:**
```json
{
  "membership_id": "whop-membership-id",
  "email": "user@example.com",
  "tier": "pro",  // optional
  "name": "User Name"  // optional
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "id": "member-uuid",
  "plan": "pro",
  "pool_limit": 1000,
  "renewal_date": "2025-11-08"
}
```

---

### 6. Whop Webhook Handler

**Endpoint:** `POST /api/whop/webhook`

**Purpose:** Handle Whop-specific webhook events (renewals, upgrades, cancellations).

**Expected Events:**
- Payment events → Update member plan and limits
- Renewal events → Reset usage and update renewal date
- Cancellation events → Log event (no status changes)

---

## 📊 Data Models

### Member
```typescript
{
  id: string (uuid)
  email: string (unique)
  plan: 'starter' | 'creator' | 'brand' | 'pro'
  pool_limit: number
  current_usage: number
  renewal_date: string (ISO date)
  created_at: string (ISO timestamp)
}
```

### Transaction
```typescript
{
  id: string (uuid)
  member_id: string (uuid)
  type: 'generation' | 'extra_credit' | 'overage'
  amount: number
  date: string (ISO timestamp)
}
```

### Image
```typescript
{
  id: string (uuid)
  member_id: string (uuid)
  url: string
  prompt: string | null
  created_at: string (ISO timestamp)
}
```

---

## 🔐 Authentication

Currently, endpoints accept `member_id` directly. In production, you should:

1. **Use session-based auth** to identify the logged-in member
2. **Extract member_id** from the session/JWT
3. **Never trust client-provided member_id** for sensitive operations

Example middleware pattern:
```typescript
// Get member_id from authenticated session
const session = await getSession(req)
const memberId = session.user.id

// Use this instead of accepting it from request body
await consumeGeneration({ memberId, prompt: body.prompt })
```

---

## 🧪 Testing

### Local Development

1. **Get a member_id** from your database:
   ```sql
   SELECT id, email FROM members LIMIT 1;
   ```

2. **Test usage endpoint**:
   ```bash
   export MEMBER_ID="your-member-uuid"
   
   curl -X POST http://localhost:3000/api/use-generation \
     -H "Content-Type: application/json" \
     -d "{\"member_id\":\"$MEMBER_ID\",\"prompt\":\"test\"}"
   ```

3. **Check status**:
   ```bash
   curl "http://localhost:3000/api/usage/status?member_id=$MEMBER_ID"
   ```

---

## 🚨 Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message here"
}
```

Common status codes:
- `400` - Bad request (missing/invalid parameters)
- `402` - Payment required (limit exceeded)
- `404` - Resource not found
- `500` - Internal server error

---

## 📈 Rate Limiting

Consider implementing rate limiting on:
- `/api/use-generation` - Prevent abuse
- `/api/add-credits` - Protect against duplicate webhooks (already has idempotency)

Recommended: Use Vercel Edge Config or Redis for rate limiting.

---

## 🔄 Migration Notes

### Key Changes from Community Model:
- ❌ `community_id` → ✅ `member_id`
- ❌ Shared usage → ✅ Individual usage
- ❌ Community table → ✅ Extended members table

### Breaking Changes:
All API endpoints that previously accepted `community_id` now require `member_id`.

Update your client code:
```diff
- fetch('/api/use-generation', { body: JSON.stringify({ community_id: id }) })
+ fetch('/api/use-generation', { body: JSON.stringify({ member_id: id }) })
```

---

## 📚 Additional Resources

- [Migration Guide](./MIGRATION_TO_MEMBER_MODEL.md)
- [Database Schema](./supabase/migrations/20251008180000_migrate_to_member_based_model.sql)
- [Usage Library](./src/lib/usage.ts)
