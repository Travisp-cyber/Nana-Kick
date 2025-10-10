import { NextResponse } from 'next/server';
import { getWhopSession, requireMemberOrAdmin } from '@/lib/auth';

export async function GET() {
  try {
    // Get the raw session
    const session = await getWhopSession();
    
    // Get the auth result
    const authResult = await requireMemberOrAdmin();
    
    // Get admin config
    const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      session: session ? {
        userId: session.userId,
        membershipId: session.membershipId,
        status: session.status,
        isValid: session.isValid
      } : null,
      authResult: {
        allowed: authResult.allowed,
        reason: authResult.reason
      },
      adminConfig: {
        adminList,
        agent,
        isUserInAdminList: session ? adminList.includes(session.userId) : false,
        isAgent: session && agent ? session.userId === agent : false
      },
      debug: {
        hasSession: !!session,
        sessionUserId: session?.userId || 'none',
        adminListCount: adminList.length
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}