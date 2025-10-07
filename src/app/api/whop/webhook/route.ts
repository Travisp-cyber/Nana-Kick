import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchWhopMembership, getRenewalDate, isMembershipActive, verifyWhopSignature } from '@/lib/whop-integration'
import { getPoolLimit, normalizeTier } from '@/lib/subscription/plans'

/**
 * POST /api/whop/webhook
 *
 * Handles renewal, upgrade, and cancellation events from Whop and updates Supabase.
 * The handler is intentionally defensive and logs extensively for easy debugging.
 */
export async function POST(req: NextRequest) {
  // Read body as text first for signature verification
  const rawBody = await req.text().catch(() => '')

  const signatureOk = verifyWhopSignature(req, rawBody)
  if (!signatureOk && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let body: any = {}
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    // Fallback to empty object
    body = {}
  }

  // Best-effort extraction from multiple possible shapes
  const event = (body.event || body.type || body.action || '').toString()
  const membershipId = body.membership_id || body.data?.membership_id || body.membership?.id
  const planName = body.plan?.name || body.data?.plan?.name || body.product?.name

  // Figure out the tier + limits
  const tier = normalizeTier(planName || '')

  try {
    // For most updates we need the latest membership state
    const membership = membershipId ? await fetchWhopMembership(membershipId) : null
    const active = isMembershipActive(membership)
    const renewalDate = getRenewalDate(membership)

    // Determine action from event name (defensive: match by keywords)
    const evt = (event || '').toLowerCase()
    const isRenewal = evt.includes('payment') || evt.includes('renew') || evt.includes('went_valid')
    const isCancellation = evt.includes('cancel') || evt.includes('went_invalid') || evt.includes('expired')
    const isUpgrade = evt.includes('upgrade') || evt.includes('plan.updated')

    if (isCancellation) {
      // Schema does not include a status column. Record no-op but accept to prevent retries.
      console.warn('Cancellation event received but communities.status column is not present; skipping state change')
      return NextResponse.json({ ok: true, skipped: true })
    }

    if (isRenewal || isUpgrade) {
      if (!membershipId) {
        console.warn('Webhook renewal/upgrade without membershipId; skipping update')
        return NextResponse.json({ ok: true, skipped: true })
      }

      // Compute pool limit if we can resolve the tier
      const resolvedTier = tier || (membership ? normalizeTier(membership.plan?.name || membership.product?.name || '') : null)
      const poolLimit = resolvedTier ? getPoolLimit(resolvedTier) : undefined

      const updatePayload: Record<string, any> = {
        renewal_date: renewalDate,
      }
      if (resolvedTier) updatePayload.plan = resolvedTier
      if (poolLimit != null) updatePayload.pool_limit = poolLimit

      // Update existing community record by membership id
      let updateErr: any = null
      {
        const { error } = await supabaseAdmin
          .from('communities')
          .update(updatePayload)
          .eq('whop_membership_id', membershipId)
        updateErr = error
      }

      if (updateErr && String(updateErr?.message || '').toLowerCase().includes('column "whop_membership_id"')) {
        console.warn('communities.whop_membership_id not found in schema, skipping renewal/upgrade update')
        return NextResponse.json({ ok: true, skipped: true })
      }

      if (updateErr) {
        console.error('Supabase update error (renew/upgrade)', updateErr)
        return NextResponse.json({ error: 'Failed to update community' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    // If event unrecognized, accept to avoid retries, but log for debugging
    console.log('Unhandled Whop webhook', { event, membershipId, tier })
    return NextResponse.json({ ok: true, ignored: true })
  } catch (err) {
    console.error('Webhook processing error', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}