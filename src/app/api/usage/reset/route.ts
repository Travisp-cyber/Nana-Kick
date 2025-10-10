import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function handleReset(req: NextRequest) {
  // Optional simple auth for cron
  const requiredSecret = process.env.USAGE_CRON_SECRET
  if (requiredSecret) {
    const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (provided !== requiredSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Reset usage for users whose reset date has passed
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  
  const result = await prisma.user.updateMany({
    where: {
      usageResetDate: {
        lte: now
      }
    },
    data: {
      generationsUsed: 0,
      usageResetDate: nextMonth
    }
  })
  
  return NextResponse.json({ 
    ok: true, 
    resetCount: result.count,
    nextResetDate: nextMonth.toISOString()
  })
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