import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { normalizeTier, type PlanTier } from '@/lib/subscription/plans'

// Minimal Whop API helpers. We avoid relying on SDK specifics to keep it simple.
const WHOP_API_BASE = 'https://api.whop.com/v2'

export type WhopMembership = {
  id: string
  status?: string
  plan?: { id?: string; name?: string } | null
  product?: { id?: string; name?: string } | null
  valid_until?: string | null
  current_period_end?: string | null
}

export async function fetchWhopMembership(membershipId: string, apiKey = process.env.WHOP_API_KEY): Promise<WhopMembership | null> {
  if (!apiKey) throw new Error('WHOP_API_KEY is not set')
  const res = await fetch(`${WHOP_API_BASE}/memberships/${membershipId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('Failed to fetch Whop membership', membershipId, await safeRead(res))
    return null
  }
  return (await res.json()) as WhopMembership
}

export type WhopOrder = { membership_id?: string; membership?: { id?: string } } & Record<string, unknown>

export async function fetchWhopOrder(orderId: string, apiKey = process.env.WHOP_API_KEY): Promise<WhopOrder | null> {
  if (!apiKey) throw new Error('WHOP_API_KEY is not set')
  const res = await fetch(`${WHOP_API_BASE}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('Failed to fetch Whop order', orderId, await safeRead(res))
    return null
  }
  return await res.json()
}


export function isMembershipActive(m: WhopMembership | null): boolean {
  if (!m) return false
  const s = (m.status || '').toLowerCase()
  return ['active', 'valid', 'trialing', 'past_due'].includes(s)
}

export function getRenewalDate(m: WhopMembership | null): string | null {
  const dateStr = m?.current_period_end || m?.valid_until
  if (dateStr) return new Date(dateStr).toISOString()
  // Fallback: 30 days from now
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}

export function verifyWhopSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // allow in dev

  // Whop usually sends a signature header; we try both common variants.
  const sig = req.headers.get('whop-signature') || req.headers.get('x-whop-signature')
  if (!sig) return false

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(rawBody)
  const expected = hmac.digest('hex')

  // Simple timing-safe comparison
  return timingSafeEqual(expected, sig)
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

async function safeRead(res: Response) {
  try { return await res.text() } catch { return '[unreadable]' }
}