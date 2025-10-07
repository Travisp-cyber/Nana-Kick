/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchWhopMembership, fetchWhopOrder, getRenewalDate, isMembershipActive } from '@/lib/whop-integration'
import { getPoolLimit, normalizeTier, type PlanTier } from '@/lib/subscription/plans'

/**
 * POST /api/whop/subscribe
 *
 * Purpose: Handle a new subscription after checkout. This route verifies the subscription
 * with Whop and creates a community record in Supabase.
 *
 * Expected inputs (flexible to make debugging simple):
 * - membership_id?: string   // Preferred: Whop membership ID
 * - order_id?: string        // Alternative: Whop order ID (we'll resolve to membership)
 * - tier?: 'starter'|'creator'|'brand'|'pro' // Optional manual override for tier
 * - email?: string           // Optional: future usage for linking members
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
      // Try common places where membership id might live
      membershipId = order?.membership_id || order?.membership?.id || order?.data?.membership_id
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
    const name = (body as any).name || `Community ${new Date().toISOString().slice(0,10)} ${tier}`

    // Insert community row and return id. We try with whop_membership_id if present, then retry without if schema lacks it.
    let insertErr: any = null
    let insertedId: string | null = null
    {
      const { data, error } = await supabaseAdmin
        .from('communities')
        .insert({
          name,
          plan: tier,
          pool_limit: poolLimit,
          renewal_date: renewalDate,
          current_usage: 0,
          member_count: 1,
          whop_membership_id: membershipId || null,
        } as any)
        .select('id')
      insertErr = error
      if (!error && data && data.length > 0) insertedId = (data[0] as any).id
    }

    if (insertErr && String(insertErr?.message || '').toLowerCase().includes('column \"whop_membership_id\"')) {
      // Retry without whop_membership_id
      const { data: data2, error: retryErr } = await supabaseAdmin
        .from('communities')
        .insert({
          name,
          plan: tier,
          pool_limit: poolLimit,
          renewal_date: renewalDate,
          current_usage: 0,
          member_count: 1,
        })
        .select('id')
      insertErr = retryErr
      if (!retryErr && data2 && data2.length > 0) insertedId = (data2[0] as any).id
    }

    if (insertErr) {
      console.error('Supabase insert error (communities)', insertErr)
      return NextResponse.json({ error: 'Failed to create community', details: insertErr.message }, { status: 500 })
    }

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