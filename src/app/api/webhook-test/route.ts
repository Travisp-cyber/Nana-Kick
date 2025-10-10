import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get recent users from database to see what webhooks have been processed
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        whopUserId: true,
        email: true,
        subscriptionStatus: true,
        planId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      message: 'Recent users in database (from webhooks)',
      users: recentUsers,
      total: recentUsers.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}