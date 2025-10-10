/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchWhopMembership, fetchWhopOrder, getRenewalDate, isMembershipActive } from '@/lib/whop-integration'
import { getPoolLimit, normalizeTier, type PlanTier } from '@/lib/subscription/plans'

/**
 * POST /api/whop/subscribe
 *
 * Purpose: Handle a new subscription after checkout. This route verifies the subscription
 * with Whop and creates a member record in Supabase.
 *
 * Expected inputs (flexible to make debugging simple):
 * - membership_id?: string   // Preferred: Whop membership ID
 * - order_id?: string        // Alternative: Whop order ID (we'll resolve to membership)
 * - tier?: 'starter'|'creator'|'brand'|'pro' // Optional manual override for tier
 * - email?: string           // Required: email for member identification
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      membership_id?: string
      order_id?: string
      tier?: string
      email?: string
      name?: string
    }

    const providedTier = normalizeTier(body.tier || '')

    let membershipId = body.membership_id
    if (!membershipId && body.order_id) {
      const order = await fetchWhopOrder(body.order_id).catch(err => {
        console.error('fetchWhopOrder error', err)
        return null
      })
      // Safe nested access to support varying shapes
      const getProp = (obj: unknown, path: string[]): unknown => {
        return path.reduce((acc: any, key) => (acc && typeof acc === 'object' ? (acc as any)[key] : undefined), obj as any)
      }
      const resolved = (getProp(order, ['membership_id']) || getProp(order, ['membership','id']) || getProp(order, ['data','membership_id'])) as string | undefined
      membershipId = resolved
    }

    if (!membershipId && !providedTier) {
      return NextResponse.json({
        error: 'Missing membership_id/order_id or tier',
      }, { status: 400 })
    }

    // Verify via Whop when possible
    const membership = membershipId ? await fetchWhopMembership(membershipId).catch(err => {
      console.error('fetchWhopMembership error', err)
      return null
    }) : null

    const active = isMembershipActive(membership)
    if (membershipId && !active) {
      return NextResponse.json({ error: 'Membership is not active' }, { status: 400 })
    }

    const tier: PlanTier | null = providedTier || (membership ? normalizeTier(membership.plan?.name || membership.product?.name || '') : null)
    if (!tier) {
      return NextResponse.json({ error: 'Unable to resolve plan tier' }, { status: 400 })
    }

    const poolLimit = getPoolLimit(tier)
    const renewalDate = getRenewalDate(membership)
    const email = body.email || (membership as any)?.email || (membership as any)?.user?.email

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Upsert user in Prisma (create if doesn't exist, update if exists)
    let user
    try {
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      
      user = await prisma.user.upsert({
        where: { email },
        update: {
          currentTier: tier,
          generationsLimit: poolLimit,
          usageResetDate: renewalDate ? new Date(renewalDate) : nextMonth,
        },
        create: {
          whopUserId: membershipId || email, // Use email as fallback if membershipId is undefined
          email,
          currentTier: tier,
          generationsUsed: 0,
          generationsLimit: poolLimit,
          usageResetDate: renewalDate ? new Date(renewalDate) : nextMonth,
        }
      })
    } catch (upsertErr) {
      console.error('Prisma upsert error (users)', upsertErr)
      return NextResponse.json({ error: 'Failed to create/update user', details: String(upsertErr) }, { status: 500 })
    }

    const insertedId = user?.id || null

    return NextResponse.json({
      ok: true,
      id: insertedId,
      plan: tier,
      pool_limit: poolLimit,
      renewal_date: renewalDate,
    })
  } catch (err) {
    console.error('Subscribe route error', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}