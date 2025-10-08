import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getOverageCents, normalizeTier } from '@/lib/subscription/plans'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('member_id') || ''

    if (!memberId) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
    }

    const { data: member, error } = await supabaseAdmin
      .from('members')
      .select('id, email, plan, pool_limit, current_usage')
      .eq('id', memberId)
      .maybeSingle<{ id: string; email?: string; plan?: string; pool_limit: number; current_usage: number }>()

    if (error || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const tier = normalizeTier(member.plan || '') || 'starter'
    const overage_cents = getOverageCents(tier)
    const remaining = Math.max((member.pool_limit ?? 0) - (member.current_usage ?? 0), 0)

    return NextResponse.json({
      id: member.id,
      email: member.email,
      plan: tier,
      pool_limit: member.pool_limit,
      current_usage: member.current_usage,
      remaining,
      overage_cents,
    })
  } catch (err) {
    console.error('usage status error', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}