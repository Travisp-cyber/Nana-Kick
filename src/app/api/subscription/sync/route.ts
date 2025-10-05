import { NextResponse } from 'next/server';
import { getWhopSession, syncUserFromWhop } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    // Get current session
    const session = await getWhopSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Sync user data from Whop
    const user = await syncUserFromWhop(session.userId, session.membershipId);
    
    // Log sync activity
    await prisma.accessLog.create({
      data: {
        userId: user.id,
        resource: 'subscription_sync',
        allowed: true,
        reason: 'User initiated sync',
      },
    });
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        whopUserId: user.whopUserId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Error syncing user data:', error);
    return NextResponse.json(
      { error: 'Failed to sync user data' },
      { status: 500 }
    );
  }
}