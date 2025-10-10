import { prisma } from '@/lib/prisma';
import { whopSdk } from '@/lib/whop-sdk';
import { PLAN_POOL_LIMITS, type PlanTier } from '@/lib/subscription/plans';

export async function getUserTierAndUsage(whopUserId: string) {
  // Get or create user in database
  let user = await prisma.user.findUnique({
    where: { whopUserId },
    select: {
      id: true,
      whopUserId: true,
      currentTier: true,
      generationsUsed: true,
      generationsLimit: true,
      usageResetDate: true,
    }
  });

  // Check which access pass the user has
  const accessPassIds = [
    { id: process.env.NEXT_PUBLIC_ACCESS_PASS_STARTER_ID, tier: 'starter' as PlanTier },
    { id: process.env.NEXT_PUBLIC_ACCESS_PASS_CREATOR_ID, tier: 'creator' as PlanTier },
    { id: process.env.NEXT_PUBLIC_ACCESS_PASS_PRO_ID, tier: 'pro' as PlanTier },
    { id: process.env.NEXT_PUBLIC_ACCESS_PASS_BRAND_ID, tier: 'brand' as PlanTier },
  ];

  let userTier: PlanTier | null = null;

  for (const { id, tier } of accessPassIds) {
    if (!id) continue;
    
    try {
      const result = await whopSdk.access.checkIfUserHasAccessToAccessPass({
        userId: whopUserId,
        accessPassId: id,
      });
      
      if (result.hasAccess) {
        userTier = tier;
        break;
      }
    } catch (err) {
      console.error('Error checking access pass:', id, err);
    }
  }

  // Check if user is admin
  const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
  const isAdmin = adminList.includes(whopUserId) || (agent && whopUserId === agent);
  
  if (!userTier && !isAdmin) {
    return { hasAccess: false, tier: null, usage: null };
  }
  
  // For admin users, use a high but trackable limit
  if (isAdmin) {
    userTier = 'admin';
  }

  const limit = PLAN_POOL_LIMITS[userTier as PlanTier];
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Create user if doesn't exist
  if (!user) {
    user = await prisma.user.create({
      data: {
        whopUserId,
        currentTier: userTier,
        generationsUsed: 0,
        generationsLimit: limit,
        usageResetDate: nextMonth,
      },
      select: {
        id: true,
        whopUserId: true,
        currentTier: true,
        generationsUsed: true,
        generationsLimit: true,
        usageResetDate: true,
      }
    });
  } else {
    // Reset usage if past reset date
    if (user.usageResetDate && now > user.usageResetDate) {
      user = await prisma.user.update({
        where: { whopUserId },
        data: {
          generationsUsed: 0,
          usageResetDate: nextMonth,
          currentTier: userTier,
          generationsLimit: limit,
        },
        select: {
          id: true,
          whopUserId: true,
          currentTier: true,
          generationsUsed: true,
          generationsLimit: true,
          usageResetDate: true,
        }
      });
    }
    
    // Update tier if it changed
    if (user.currentTier !== userTier) {
      user = await prisma.user.update({
        where: { whopUserId },
        data: {
          currentTier: userTier,
          generationsLimit: limit,
        },
        select: {
          id: true,
          whopUserId: true,
          currentTier: true,
          generationsUsed: true,
          generationsLimit: true,
          usageResetDate: true,
        }
      });
    }
  }

  return {
    hasAccess: true,
    tier: userTier,
    usage: {
      used: user.generationsUsed,
      limit: user.generationsLimit || limit,
      remaining: Math.max((user.generationsLimit || limit) - user.generationsUsed, 0),
      resetDate: user.usageResetDate,
    }
  };
}

export async function incrementUsage(whopUserId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { whopUserId },
      data: {
        generationsUsed: { increment: 1 },
      }
    });
    return true;
  } catch (err) {
    console.error('Failed to increment usage:', err);
    return false;
  }
}

