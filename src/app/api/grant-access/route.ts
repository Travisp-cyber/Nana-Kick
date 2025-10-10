import { NextResponse } from 'next/server';
import { syncUserFromWhop } from '@/lib/auth';

// Temporary endpoint to manually grant access to promo code users
export async function POST() {
  try {
    // Grant access to the test user with promo code subscription
    const testUserId = 'user_xSDKRLyIMBgXL';
    
    const user = await syncUserFromWhop({
      userId: testUserId,
      membershipId: 'promo_code_membership',
      status: 'active',
      planId: 'creator_plan',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    });
    
    return NextResponse.json({
      success: true,
      message: 'Access granted to promo code user',
      user: {
        id: user.id,
        whopUserId: user.whopUserId,
        subscriptionStatus: user.subscriptionStatus
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to grant access',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}