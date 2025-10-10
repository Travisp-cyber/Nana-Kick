import { NextResponse } from 'next/server'
import { requireMemberOrAdmin } from '@/lib/auth'

export async function GET() {
  try {
    const gate = await requireMemberOrAdmin()
    
    return NextResponse.json({
      allowed: gate.allowed,
      reason: gate.reason,
      session: gate.session,
      isAdmin: gate.reason === 'admin',
      userId: gate.session?.userId,
      membershipId: gate.session?.membershipId,
    })
  } catch (error) {
    console.error('Error in /api/whoami:', error)
    return NextResponse.json({
      allowed: false,
      reason: 'error',
      session: null,
      isAdmin: false,
      userId: null,
      membershipId: null,
    }, { status: 500 })
  }
}
