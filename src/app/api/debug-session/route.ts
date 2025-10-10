import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getWhopSession, requireMemberOrAdmin } from '@/lib/auth';

export async function GET() {
  try {
    // Get raw headers
    const h = await headers();
    const headerObj: Record<string, string> = {};
    h.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // Get session details
    const session = await getWhopSession();
    const authResult = await requireMemberOrAdmin();
    
    // Get admin config
    const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      headers: {
        whopRelated: Object.keys(headerObj).filter(key => 
          key.toLowerCase().includes('whop') || 
          key.toLowerCase().includes('auth') ||
          key.toLowerCase().includes('user') ||
          key.toLowerCase().includes('membership')
        ).reduce((acc, key) => {
          acc[key] = headerObj[key];
          return acc;
        }, {} as Record<string, string>),
        total: Object.keys(headerObj).length
      },
      session: session ? {
        userId: session.userId,
        membershipId: session.membershipId,
        companyId: session.companyId,
        status: session.status,
        planId: session.planId,
        currentPeriodEnd: session.currentPeriodEnd,
        isValid: session.isValid,
      } : null,
      authResult: {
        allowed: authResult.allowed,
        reason: authResult.reason
      },
      adminConfig: {
        adminList,
        currentUserId: session?.userId,
        isInAdminList: session ? adminList.includes(session.userId) : false,
      },
      // Try to see if there are any subscription indicators in headers
      subscriptionIndicators: {
        hasMembershipId: !!session?.membershipId,
        hasStatus: !!session?.status,
        hasPlanId: !!session?.planId,
        statusValue: session?.status || 'none',
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