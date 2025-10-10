import { NextResponse } from 'next/server'
import { requireMemberOrAdmin, getWhopSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getWhopSession()
    const gate = await requireMemberOrAdmin()
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      
      // Session info
      session: session ? {
        userId: session.userId,
        membershipId: session.membershipId,
        companyId: session.companyId,
        isValid: session.isValid,
        status: session.status,
        planId: session.planId,
      } : null,
      
      // Gate check results
      gate: {
        allowed: gate.allowed,
        reason: gate.reason,
      },
      
      // Admin configuration
      adminConfig: {
        agentUserId: process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID || 'not set',
        adminUserIds: process.env.ADMIN_WHOP_USER_IDS || 'not set',
      },
      
      // Is this user an admin?
      isAdmin: session ? (
        session.userId === process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID ||
        (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).includes(session.userId)
      ) : false,
    }
    
    console.log('🔍 Auth Debug Info:', debugInfo)
    
    return NextResponse.json(debugInfo)
  } catch (error) {
    console.error('Debug auth error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get auth info',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}