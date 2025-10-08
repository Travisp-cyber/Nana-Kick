import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyWhopSignature } from '@/lib/whop-integration'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// Accept these credit amounts via products: 100, 500, 1000
const ALLOWED_AMOUNTS = new Set([100, 500, 1000])

type AddCreditsPayload = {
  event?: string
  id?: string
  event_id?: string
  data?: Record<string, unknown>
  credits?: number
  member_id?: string
  metadata?: Record<string, unknown>
}

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export async function POST(req: NextRequest) {
  // Read raw body for signature validation
  const rawBody = await req.text().catch(() => '')
  const sigOk = verifyWhopSignature(req, rawBody)
  if (!sigOk && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Parse payload defensively
  let body: AddCreditsPayload = {}
  try {
    body = rawBody ? (JSON.parse(rawBody) as AddCreditsPayload) : {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resolve values from multiple possible shapes
  const eventType = String(
    body.event || (body.data?.['event'] as string | undefined) || 'unknown'
  )

  const memberId =
    (body.member_id as string | undefined) ||
    (body.metadata?.['member_id'] as string | undefined) ||
    (body.data?.['member_id'] as string | undefined)

  // Credits may be in body.credits, data.credits, or derived from product
  const credits = (body.credits as number | undefined) ||
    (body.data?.['credits'] as number | undefined) ||
    undefined

  // Basic validation
  if (!memberId) {
    return NextResponse.json({ error: 'Missing member_id' }, { status: 400 })
  }

  if (typeof credits !== 'number') {
    return NextResponse.json({ error: 'Missing credits amount' }, { status: 400 })
  }

  if (!ALLOWED_AMOUNTS.has(credits)) {
    return NextResponse.json({ error: 'Unsupported credits amount' }, { status: 400 })
  }

  // Idempotency: compute a stable event key
  const incomingEventId = body.event_id || body.id || (body.data?.['id'] as string | undefined)
  const eventKey = incomingEventId ? `whop:${incomingEventId}` : `hash:${sha256Hex(rawBody)}`

  // Insert into webhook_events table to guard against duplicates
  const { error: idempErr } = await supabaseAdmin
    .from('webhook_events')
    .insert({ event_id: eventKey, event_type: eventType, member_id: memberId })

  if (idempErr) {
    // If unique violation, treat as processed
    const msg = String(idempErr.message || '').toLowerCase()
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
      return NextResponse.json({ ok: true, deduped: true })
    }
    // Other errors
    return NextResponse.json({ error: 'Failed to record webhook event' }, { status: 500 })
  }

  // Update pool_limit by adding credits. We'll do a read-then-compare-and-swap to avoid lost updates.
  const { data: member, error: fetchErr } = await supabaseAdmin
    .from('members')
    .select('id, pool_limit')
    .eq('id', memberId)
    .maybeSingle<{ id: string; pool_limit: number }>()

  if (fetchErr || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // First attempt optimistic update
  const target = (member.pool_limit ?? 0) + credits
  let updated = false
  {
    const { error: updErr, data } = await supabaseAdmin
      .from('members')
      .update({ pool_limit: target })
      .eq('id', memberId)
      .eq('pool_limit', member.pool_limit)
      .select('id')

    if (!updErr && data && data.length > 0) {
      updated = true
    }
  }

  // If failed due to race, refetch and retry once
  if (!updated) {
    const { data: fresh, error: refErr } = await supabaseAdmin
      .from('members')
      .select('id, pool_limit')
      .eq('id', memberId)
      .maybeSingle<{ id: string; pool_limit: number }>()

    if (refErr || !fresh) {
      return NextResponse.json({ error: 'Failed to refresh member' }, { status: 500 })
    }

    const secondTarget = (fresh.pool_limit ?? 0) + credits
    const { error: secondUpdErr, data: secondData } = await supabaseAdmin
      .from('members')
      .update({ pool_limit: secondTarget })
      .eq('id', memberId)
      .eq('pool_limit', fresh.pool_limit)
      .select('id')

    if (secondUpdErr || !secondData || secondData.length === 0) {
      return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
    }
  }

  // Log transaction
  const { error: txnErr } = await supabaseAdmin
    .from('transactions')
    .insert({ member_id: memberId, type: 'extra_credit', amount: credits })

  if (txnErr) {
    // Not fatal to credits update, but return an error so it can be retried manually
    return NextResponse.json({ error: 'Credits added, but transaction insert failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}