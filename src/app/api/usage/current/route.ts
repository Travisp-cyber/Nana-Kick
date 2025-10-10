import { NextRequest, NextResponse } from 'next/server';
import { whopSdk } from '@/lib/whop-sdk';
import { getUserTierAndUsage } from '@/lib/whop-usage';

export async function GET(request: NextRequest) {
  try {
    // Check if we're in development mode
    const isDev = process.env.NODE_ENV !== 'production';
    
    // Check if request is coming from Whop platform (iframe context)
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer') || '';
    const isWhopRequest = origin?.includes('whop.com') || referer.includes('whop.com');
    
    let whopUserId: string | null = null;
    
    if (!isDev) {
      // Only allow requests from Whop platform
      if (!isWhopRequest) {
        return NextResponse.json(
          { hasAccess: false, error: 'Access denied' },
          { status: 403 }
        );
      }

      // Try to get user from headers first
      const xWhopUserId = request.headers.get('x-whop-user-id');
      const xWhopUserToken = request.headers.get('x-whop-user-token');
      
      if (xWhopUserId && xWhopUserToken) {
        // Headers are available, verify the token
        try {
          const result = await whopSdk.verifyUserToken(request.headers);
          whopUserId = result.userId;
          console.log('✅ Verified user from headers:', whopUserId);
        } catch (err) {
          console.error('Failed to verify user token:', err);
          // Try to use the header directly if verification fails
          whopUserId = xWhopUserId;
          console.log('⚠️ Using user ID from header directly:', whopUserId);
        }
      }
      
      // If we have a real user ID, check if admin and handle usage
      if (whopUserId) {
        const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
        const isAdmin = adminList.includes(whopUserId) || (agent && whopUserId === agent);
        
        if (isAdmin) {
          // Fetch actual usage from database for admin
          const adminResult = await getUserTierAndUsage(whopUserId);
          const adminLimit = 10000;
          
          return NextResponse.json({
            hasAccess: true,
            isAdmin: true,
            tier: 'admin',
            usage: adminResult.usage || { used: 0, limit: adminLimit, remaining: adminLimit }
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
      } else {
        // No user ID available - check if we can infer admin status from context
        // This is a fallback for iframe contexts where headers might not be available
        const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        
        if (adminList.length > 0) {
          // For iframe context without headers, assume admin access for now
          // This is a temporary solution until we can properly integrate Whop's iframe SDK
          console.log('⚠️ No headers available, assuming admin access for iframe context');
          const adminLimit = 10000;
          return NextResponse.json({
            hasAccess: true,
            isAdmin: true,
            tier: 'admin',
            usage: {
              used: 0,
              limit: adminLimit,
              remaining: adminLimit,
            }
          });
        } else {
          return NextResponse.json(
            { hasAccess: false, message: 'User authentication required' },
            { status: 401 }
          );
        }
      }
    } else {
      // Development mode - return admin access with trackable limit
      const adminLimit = 10000;
      return NextResponse.json({
        hasAccess: true,
        isAdmin: true,
        tier: 'admin',
        usage: {
          used: 0,
          limit: adminLimit,
          remaining: adminLimit,
        }
      });
    }
  } catch (err) {
    console.error('Failed to fetch usage:', err);
    return NextResponse.json(
      { hasAccess: false, error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}

