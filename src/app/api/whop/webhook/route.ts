/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchWhopMembership, fetchWhopUser, getRenewalDate, verifyWhopSignature } from '@/lib/whop-integration'
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

  let body: unknown
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    // Fallback to empty object
    body = {}
  }

  // Best-effort extraction from multiple possible shapes
  const getProp = (obj: unknown, path: string[]): unknown => {
    return path.reduce((acc: any, key) => (acc && typeof acc === 'object' ? (acc as any)[key] : undefined), obj as any)
  }
  const event = String((getProp(body, ['event']) || getProp(body, ['type']) || getProp(body, ['action']) || '') as string)
  const membershipId = (getProp(body, ['membership_id']) || getProp(body, ['data','membership_id']) || getProp(body, ['membership','id'])) as string | undefined
  const userId = (getProp(body, ['user_id']) || getProp(body, ['data','user_id'])) as string | undefined
  const planName = (getProp(body, ['plan','name']) || getProp(body, ['data','plan','name']) || getProp(body, ['product','name'])) as string | undefined
  const paymentAmount = (getProp(body, ['final_amount']) || getProp(body, ['data','final_amount']) || getProp(body, ['amount'])) as number | undefined

  // Figure out the tier + limits
  const tier = normalizeTier(planName || '')
  
  // Log payment details for debugging
  console.log('[Whop Webhook] Payment details:', {
    event,
    membershipId,
    userId,
    planName,
    paymentAmount,
    tier,
  })

  try {
    // For most updates we need the latest membership state
    const membership = membershipId ? await fetchWhopMembership(membershipId) : null
    const renewalDate = getRenewalDate(membership)

    // Determine action from event name (defensive: match by keywords)
    const evt = (event || '').toLowerCase()
    const isRenewal = evt.includes('payment') || evt.includes('renew') || evt.includes('went_valid')
    const isCancellation = evt.includes('cancel') || evt.includes('went_invalid') || evt.includes('expired')
    const isUpgrade = evt.includes('upgrade') || evt.includes('plan.updated')

    if (isCancellation) {
      // Schema does not include a status column. Record no-op but accept to prevent retries.
      console.warn('Cancellation event received but members.status column is not present; skipping state change')
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

      // Extract email and whopUserId from multiple sources
      let email = (membership as any)?.email || (membership as any)?.user?.email
      let whopUserId = userId || (membership as any)?.user?.id
      
      // If email is still missing, try to fetch user data from Whop API
      if (!email && whopUserId) {
        console.log(`📞 Fetching user data from Whop API for userId: ${whopUserId}`)
        const whopUser = await fetchWhopUser(whopUserId)
        if (whopUser?.email) {
          email = whopUser.email
          console.log(`✅ Found email from Whop API: ${email}`)
        }
      }
      
      // Use membershipId as fallback for whopUserId if all else fails
      if (!whopUserId) {
        whopUserId = membershipId
        console.log(`⚠️ Using membershipId as whopUserId fallback: ${whopUserId}`)
      }
      
      // If still no email, create a placeholder email
      if (!email) {
        email = `${whopUserId}@whop.placeholder`
        console.log(`⚠️ Creating placeholder email: ${email}`)
      }

      // Log payment type for debugging
      if (paymentAmount === 0) {
        console.log(`💡 $0.00 payment detected - likely free trial or promotional membership`)
      }

      // Upsert user record (create if doesn't exist, update if exists)
      try {
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        
        await prisma.user.upsert({
          where: { whopUserId },
          update: {
            email,
            currentTier: resolvedTier || 'starter',
            generationsLimit: poolLimit ?? getPoolLimit('starter'),
            usageResetDate: renewalDate ? new Date(renewalDate) : nextMonth,
            membershipId,
          },
          create: {
            whopUserId,
            email,
            currentTier: resolvedTier || 'starter',
            generationsUsed: 0,
            generationsLimit: poolLimit ?? getPoolLimit('starter'),
            usageResetDate: renewalDate ? new Date(renewalDate) : nextMonth,
            membershipId,
          }
        })
        
        console.log(`✅ User upserted successfully: ${whopUserId} (${email}) - Tier: ${resolvedTier || 'starter'}`)
      } catch (upsertErr) {
        console.error('Prisma upsert error (renew/upgrade)', upsertErr)
        return NextResponse.json({ error: 'Failed to upsert user' }, { status: 500 })
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