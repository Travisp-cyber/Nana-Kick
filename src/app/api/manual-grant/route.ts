import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { userId, planId = 'plan_aKqigTdeYP0dU' } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Manually create/update user with active subscription
    const user = await prisma.user.upsert({
      where: { whopUserId: userId },
      update: {
        subscriptionStatus: 'active',
        planId: planId,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      create: {
        whopUserId: userId,
        email: `${userId}@promo.test`,
        name: `Promo User ${userId}`,
        subscriptionStatus: 'active',
        planId: planId,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User access granted manually',
      user: {
        id: user.id,
        whopUserId: user.whopUserId,
        status: user.subscriptionStatus,
        planId: user.planId,
        currentPeriodEnd: user.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error('Manual grant error:', error);
    return NextResponse.json({
      error: 'Failed to grant access',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Also add a GET method to check what users exist
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        whopUserId: true,
        email: true,
        subscriptionStatus: true,
        planId: true,
        createdAt: true,
        currentPeriodEnd: true,
      }
    });

    return NextResponse.json({
      users,
      total: users.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}