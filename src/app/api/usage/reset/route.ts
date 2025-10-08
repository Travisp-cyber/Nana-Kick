import { NextRequest, NextResponse } from 'next/server'
import { resetUsageForDueMembers } from '@/lib/usage'

async function handleReset(req: NextRequest) {
  // Optional simple auth for cron
  const requiredSecret = process.env.USAGE_CRON_SECRET
  if (requiredSecret) {
    const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (provided !== requiredSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await resetUsageForDueMembers()
  return NextResponse.json({ ok: true, ...result })
}

export async function POST(req: NextRequest) {
  try {
    return await handleReset(req)
  } catch (err) {
    console.error('usage reset error', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// Optional GET to allow quick manual testing in a browser
export async function GET(req: NextRequest) {
  try {
    return await handleReset(req)
  } catch (err) {
    console.error('usage reset error (GET)', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}