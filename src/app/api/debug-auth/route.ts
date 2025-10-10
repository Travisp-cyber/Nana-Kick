import { NextRequest, NextResponse } from 'next/server';
import { requireMemberOrAdmin, getWhopSession } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    // Get raw session info
    const session = await getWhopSession();
    
    // Get gate result
    const gate = await requireMemberOrAdmin();
    
    // Get admin configuration
    const adminList = (process.env.ADMIN_WHOP_USER_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const agentUserId = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
    
    // Check if current user is in admin list
    const isInAdminList = session ? adminList.includes(session.userId) : false;
    const isAgent = session && agentUserId ? session.userId === agentUserId : false;
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      gate: {
        allowed: gate.allowed,
        reason: gate.reason,
      },
      session: session ? {
        userId: session.userId,
        membershipId: session.membershipId,
        status: session.status,
        isValid: session.isValid,
      } : null,
      adminCheck: {
        isInAdminList,
        isAgent,
        isAdmin: isInAdminList || isAgent,
        adminListSize: adminList.length,
        adminList: adminList, // Show the actual list for debugging
        hasAgentId: !!agentUserId,
        agentUserId: agentUserId, // Show the actual agent ID
      },
      verdict: gate.allowed
        ? `✅ Access GRANTED - Reason: ${gate.reason}`
        : `❌ Access DENIED - Reason: ${gate.reason}`,
    }, { status: 200 });
  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json({
      error: 'Failed to debug auth',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}