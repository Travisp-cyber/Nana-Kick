import { NextResponse } from 'next/server'
import { requireMemberOrAdmin, getWhopSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getWhopSession()
    const gate = await requireMemberOrAdmin()
    
    // Check if user is actually an admin first
    const isActualAdmin = session ? (
      session.userId === process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID ||
      (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).includes(session.userId)
    ) : false
    
    // If not an admin, don't show sensitive admin config
    if (!gate.allowed || (gate.reason !== 'admin' && gate.reason !== 'dev_mode' && !isActualAdmin)) {
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        gate: {
          allowed: gate.allowed,
          reason: gate.reason,
        },
        message: 'Access denied - admin privileges required for full debug info'
      }, { status: 403 })
    }
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      
      // Session info (only show to admins)
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
      
      // Admin configuration (only show to verified admins)
      adminConfig: isActualAdmin ? {
        agentUserId: process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID || 'not set',
        adminUserIds: process.env.ADMIN_WHOP_USER_IDS || 'not set',
      } : { message: 'Admin config hidden - insufficient privileges' },
      
      // Is this user an admin?
      isAdmin: isActualAdmin,
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