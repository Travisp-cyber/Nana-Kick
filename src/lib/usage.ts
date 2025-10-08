import { supabaseAdmin } from '@/lib/supabase/admin'
import { type PlanTier } from '@/lib/subscription/plans'

/**
 * Member shape used by usage helpers.
 */
export type MemberUsage = {
  id: string
  plan?: PlanTier | string
  pool_limit: number
  current_usage: number
}

/**
 * Safely consume one generation for a member, enforcing pool limits and
 * logging a transaction. Uses optimistic concurrency to avoid double-counting.
 */
export async function consumeGeneration(input: {
  memberId: string
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
}>
  const { memberId } = input

  // 1) Load current usage snapshot (include plan for overage pricing)
  const { data: member, error: fetchErr } = await supabaseAdmin
    .from('members')
    .select('id, plan, pool_limit, current_usage')
    .eq('id', memberId)
    .single<MemberUsage>()

  if (fetchErr || !member) {
    return { ok: false, error: 'Member not found' }
  }

  // 2) Attempt optimistic increment (we allow usage beyond pool_limit; overage handled below)
  const nextUsage = member.current_usage + 1
  const { data: updatedRows, error: updateErr } = await supabaseAdmin
    .from('members')
    .update({ current_usage: nextUsage })
    .eq('id', memberId)
    .eq('current_usage', member.current_usage)
    .select('id, pool_limit, current_usage')

  if (updateErr) {
    return { ok: false, error: 'Failed to update usage' }
  }

  // If no row updated, a race likely occurred. Re-check state once.
  let effectiveUsage = nextUsage
  let poolLimit = member.pool_limit
  if (!updatedRows || updatedRows.length === 0) {
    const { data: fresh, error: refetchErr } = await supabaseAdmin
      .from('members')
      .select('id, plan, pool_limit, current_usage')
      .eq('id', memberId)
      .single<MemberUsage>()

    if (refetchErr || !fresh) {
      return { ok: false, error: 'Failed to read updated usage' }
    }

    // Try one more time to increment (still allowing beyond pool_limit)
    const secondNext = fresh.current_usage + 1
    const { data: secondUpdate, error: secondErr } = await supabaseAdmin
      .from('members')
      .update({ current_usage: secondNext })
      .eq('id', memberId)
      .eq('current_usage', fresh.current_usage)
      .select('id, pool_limit, current_usage')

    if (secondErr || !secondUpdate || secondUpdate.length === 0) {
      return { ok: false, error: 'Failed to update usage' }
    }

    effectiveUsage = secondNext
    poolLimit = secondUpdate[0].pool_limit as unknown as number
  }

  // 3) Insert a 'generation' transaction record
  const { error: insertTxnErr } = await supabaseAdmin
    .from('transactions')
    .insert({
      member_id: memberId,
      type: 'generation',
      amount: 1,
    })

  if (insertTxnErr) {
    // Not fatal for limits, but log by returning an error to caller to retry if desired
    return { ok: false, error: 'Generation logged but transaction insert failed' }
  }

  // 3b) If this generation exceeds the included pool, record an overage unit
  const overageApplied = effectiveUsage > poolLimit
  if (overageApplied) {
    // Record one overage unit; cost can be derived by plan later from the UI/server using plan
    try {
      await supabaseAdmin
        .from('transactions')
        .insert({ member_id: memberId, type: 'overage', amount: 1 })
    } catch {
      // non-fatal
    }
  }

  // 4) Call Nano Banana API (mocked)
  const job = await callNanoBananaMock({ prompt: input.prompt, memberId })

  const remaining = Math.max(poolLimit - effectiveUsage, 0)
  return { ok: true, remaining, job }
}

/**
 * Reset usage for all members whose renewal_date is due (<= today), and
 * push renewal_date forward by 30 days.
 */
export async function resetUsageForDueMembers(): Promise<{ resetCount: number; nextRenewalDate: string }> {
  const today = new Date()
  const todayStr = toDateString(today)
  const next = addDays(today, 30)
  const nextStr = toDateString(next)

  const { data, error } = await supabaseAdmin
    .from('members')
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
async function callNanoBananaMock(_payload: { prompt?: string; memberId: string }): Promise<{ id: string; outputUrl?: string }>
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