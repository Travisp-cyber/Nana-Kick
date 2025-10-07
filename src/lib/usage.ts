import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Community shape used by usage helpers.
 */
export type CommunityUsage = {
  id: string
  pool_limit: number
  current_usage: number
}

/**
 * Safely consume one generation for a community, enforcing pool limits and
 * logging a transaction. Uses optimistic concurrency to avoid double-counting.
 */
export async function consumeGeneration(input: {
  communityId: string
  prompt?: string
  // image data or any payload for future expansion; not used in mock
  data?: unknown
}): Promise<{
  ok: true
  remaining: number
  job?: { id: string; outputUrl?: string }
} | {
  ok: false
  error: string
}> {
  const { communityId } = input

  // 1) Load current usage snapshot
  const { data: community, error: fetchErr } = await supabaseAdmin
    .from('communities')
    .select('id, pool_limit, current_usage')
    .eq('id', communityId)
    .single<CommunityUsage>()

  if (fetchErr || !community) {
    return { ok: false, error: 'Community not found' }
  }

  if (community.current_usage >= community.pool_limit) {
    return {
      ok: false,
      error: "You’ve reached your monthly limit. Upgrade or buy extra credits.",
    }
  }

  // 2) Attempt optimistic increment
  const nextUsage = community.current_usage + 1
  const { data: updatedRows, error: updateErr } = await supabaseAdmin
    .from('communities')
    .update({ current_usage: nextUsage })
    .eq('id', communityId)
    .eq('current_usage', community.current_usage)
    .select('id, pool_limit, current_usage')

  if (updateErr) {
    return { ok: false, error: 'Failed to update usage' }
  }

  // If no row updated, a race likely occurred. Re-check state once.
  let effectiveUsage = nextUsage
  let poolLimit = community.pool_limit
  if (!updatedRows || updatedRows.length === 0) {
    const { data: fresh, error: refetchErr } = await supabaseAdmin
      .from('communities')
      .select('id, pool_limit, current_usage')
      .eq('id', communityId)
      .single<CommunityUsage>()

    if (refetchErr || !fresh) {
      return { ok: false, error: 'Failed to read updated usage' }
    }

    // If now at or above limit, deny
    if (fresh.current_usage >= fresh.pool_limit) {
      return {
        ok: false,
        error: "You’ve reached your monthly limit. Upgrade or buy extra credits.",
      }
    }

    // Try one more time to increment
    const secondNext = fresh.current_usage + 1
    const { data: secondUpdate, error: secondErr } = await supabaseAdmin
      .from('communities')
      .update({ current_usage: secondNext })
      .eq('id', communityId)
      .eq('current_usage', fresh.current_usage)
      .select('id, pool_limit, current_usage')

    if (secondErr || !secondUpdate || secondUpdate.length === 0) {
      return { ok: false, error: 'Failed to update usage' }
    }

    effectiveUsage = secondNext
    poolLimit = secondUpdate[0].pool_limit as unknown as number
  }

  // 3) Insert a transaction record
  const { error: insertTxnErr } = await supabaseAdmin
    .from('transactions')
    .insert({
      community_id: communityId,
      type: 'generation',
      amount: 1,
    })

  if (insertTxnErr) {
    // Not fatal for limits, but log by returning an error to caller to retry if desired
    return { ok: false, error: 'Generation logged but transaction insert failed' }
  }

  // 4) Call Nano Banana API (mocked)
  const job = await callNanoBananaMock({ prompt: input.prompt, communityId })

  const remaining = poolLimit - effectiveUsage
  return { ok: true, remaining, job }
}

/**
 * Reset usage for all communities whose renewal_date is due (<= today), and
 * push renewal_date forward by 30 days.
 */
export async function resetUsageForDueCommunities(): Promise<{ resetCount: number; nextRenewalDate: string }> {
  const today = new Date()
  const todayStr = toDateString(today)
  const next = addDays(today, 30)
  const nextStr = toDateString(next)

  const { data, error } = await supabaseAdmin
    .from('communities')
    .update({ current_usage: 0, renewal_date: nextStr })
    .lte('renewal_date', todayStr)
    .select('id')

  if (error) {
    // Surface error via zero count; callers can log
    return { resetCount: 0, nextRenewalDate: nextStr }
  }

  return { resetCount: (data?.length ?? 0), nextRenewalDate: nextStr }
}

/**
 * Mock for Nano Banana API. Replace with a real call later.
 */
async function callNanoBananaMock(_payload: { prompt?: string; communityId: string }): Promise<{ id: string; outputUrl?: string }> {
  // mark param as used for lint
  void _payload
  // Simulate processing latency minimally
  await new Promise((r) => setTimeout(r, 20))
  return { id: `mock_${Math.random().toString(36).slice(2)}`, outputUrl: 'https://example.com/output.png' }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateString(date: Date): string {
  // Format YYYY-MM-DD in UTC
  return date.toISOString().slice(0, 10)
}