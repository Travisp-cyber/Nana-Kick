import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily Usage Reset Cron Job
 * 
 * This endpoint is called by Vercel Cron every day at midnight UTC.
 * It resets the usage counter for all users whose individual reset date has passed.
 * Each user resets on their own subscription anniversary (e.g., subscribed on Oct 15 = resets on Nov 15).
 * 
 * Schedule: 0 0 * * * (midnight every day, UTC)
 * 
 * To test manually:
 * curl -X GET https://your-app.vercel.app/api/cron/reset-usage \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function GET(request: NextRequest) {
  console.log('[CRON] Usage reset job started');

  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('[CRON] CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron secret not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    console.error('[CRON] Unauthorized access attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Find all users whose reset date has passed
    const usersToReset = await prisma.user.findMany({
      where: {
        usageResetDate: {
          lte: now
        }
      },
      select: {
        id: true,
        whopUserId: true,
        generationsUsed: true,
        currentTier: true,
      }
    });

    console.log(`[CRON] Found ${usersToReset.length} users to reset`);

    if (usersToReset.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users need reset at this time',
        usersReset: 0,
        timestamp: now.toISOString()
      });
    }

    // Reset usage for all eligible users
    const result = await prisma.user.updateMany({
      where: {
        usageResetDate: {
          lte: now
        }
      },
      data: {
        generationsUsed: 0,
        usageResetDate: nextMonth
      }
    });

    console.log(`[CRON] Successfully reset ${result.count} users`);

    // Log details about reset users
    usersToReset.forEach(user => {
      console.log(`[CRON] Reset user ${user.whopUserId}: ${user.generationsUsed} generations → 0 (tier: ${user.currentTier})`);
    });

    return NextResponse.json({
      success: true,
      message: 'Usage reset completed successfully',
      usersReset: result.count,
      nextResetDate: nextMonth.toISOString(),
      timestamp: now.toISOString(),
      details: usersToReset.map(u => ({
        whopUserId: u.whopUserId,
        previousUsage: u.generationsUsed,
        tier: u.currentTier
      }))
    });
  } catch (error) {
    console.error('[CRON] Error resetting usage:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset usage',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

