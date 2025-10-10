import { NextRequest, NextResponse } from 'next/server';
import { whopSdk } from '@/lib/whop-sdk';
import { getUserTierAndUsage } from '@/lib/whop-usage';

export async function GET(request: NextRequest) {
  try {
    const { userId: whopUserId } = await whopSdk.verifyUserToken(request.headers);
    
    // Check if admin
    const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
    const isAdmin = adminList.includes(whopUserId) || (agent && whopUserId === agent);
    
    if (isAdmin) {
      return NextResponse.json({
        hasAccess: true,
        isAdmin: true,
        tier: 'admin',
        usage: {
          used: 0,
          limit: 999999,
          remaining: 999999,
        }
      });
    }
    
    const result = await getUserTierAndUsage(whopUserId);
    
    if (!result.hasAccess) {
      return NextResponse.json(
        { hasAccess: false, message: 'No active subscription' },
        { status: 200 }
      );
    }
    
    return NextResponse.json({
      hasAccess: true,
      isAdmin: false,
      tier: result.tier,
      usage: result.usage,
    });
  } catch (err) {
    console.error('Failed to fetch usage:', err);
    return NextResponse.json(
      { hasAccess: false, error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}

