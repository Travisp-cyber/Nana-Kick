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
      
      // Debug: Log all headers to see what's available in iframe context
      console.log('🔍 Available headers in iframe context:', {
        'x-whop-user-id': xWhopUserId,
        'x-whop-user-token': xWhopUserToken,
        'x-whop-authorization': request.headers.get('x-whop-authorization'),
        'authorization': request.headers.get('authorization'),
        'cookie': request.headers.get('cookie'),
        'referer': request.headers.get('referer'),
        'origin': request.headers.get('origin'),
        'user-agent': request.headers.get('user-agent'),
      });
      
      if (xWhopUserToken) {
        // JWT token is available, try to decode it to get user ID
        try {
          // First try SDK verification
          const result = await whopSdk.verifyUserToken(request.headers);
          whopUserId = result.userId;
          console.log('✅ Verified user from SDK:', whopUserId);
        } catch (err) {
          console.error('SDK verification failed, decoding JWT manually:', err);
          
          // Fallback: manually decode JWT to extract user ID
          try {
            // JWT format: header.payload.signature
            const parts = xWhopUserToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
              whopUserId = payload.sub; // 'sub' field contains the user ID
              console.log('✅ Extracted user ID from JWT:', whopUserId);
            } else {
              throw new Error('Invalid JWT format');
            }
          } catch (jwtErr) {
            console.error('Failed to decode JWT:', jwtErr);
            throw new Error('User authentication required');
          }
        }
      } else if (xWhopUserId) {
        // Direct user ID available
        whopUserId = xWhopUserId;
        console.log('✅ Using direct user ID:', whopUserId);
      }
      
      // If we have a real user ID, check if admin and handle usage
      if (whopUserId) {
        const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
        const isAdmin = whopUserId ? (adminList.includes(whopUserId) || (agent && whopUserId === agent)) : false;
        
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
        // No user ID available - cannot verify user
        return NextResponse.json(
          { hasAccess: false, message: 'User authentication required' },
          { status: 401 }
        );
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

