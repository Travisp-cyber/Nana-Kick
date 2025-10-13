import { prisma } from '@/lib/prisma';
import { whopSdk } from '@/lib/whop-sdk';
import { PLAN_POOL_LIMITS, getOverageCents, type PlanTier } from '@/lib/subscription/plans';

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
      overageUsed: true,
      overageCharges: true,
      lastBillingDate: true,
      freeTrialUsed: true,
      hasClaimedFreeTrial: true,
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
  
  // If user doesn't exist and has no tier, create them with free trial
  if (!user && !userTier && !isAdmin) {
    console.log(`🆕 Creating new free trial user: ${whopUserId}`);
    user = await prisma.user.create({
      data: {
        whopUserId,
        freeTrialUsed: 10,
        hasClaimedFreeTrial: false,
        generationsUsed: 0,
      },
      select: {
        id: true,
        whopUserId: true,
        currentTier: true,
        generationsUsed: true,
        generationsLimit: true,
        usageResetDate: true,
        overageUsed: true,
        overageCharges: true,
        lastBillingDate: true,
        freeTrialUsed: true,
        hasClaimedFreeTrial: true,
      }
    });
  }
  
  // Check for free trial access if no paid subscription
  if (!userTier && !isAdmin) {
    // If user exists and has free trial remaining, grant access
    if (user && user.freeTrialUsed > 0) {
      return {
        hasAccess: true,
        tier: 'free-trial' as PlanTier,
        usage: {
          used: 10 - user.freeTrialUsed,
          limit: 10,
          remaining: user.freeTrialUsed,
          resetDate: null,
          overageUsed: 0,
          overageCharges: 0,
          overageCentsPerGen: 0,
          lastBillingDate: null,
          freeTrialUsed: user.freeTrialUsed,
          hasClaimedFreeTrial: user.hasClaimedFreeTrial,
        }
      };
    }
    
    // No access if no tier and no free trial
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
        overageUsed: 0,
        overageCharges: 0,
        freeTrialUsed: 10,
        hasClaimedFreeTrial: false,
      },
      select: {
        id: true,
        whopUserId: true,
        currentTier: true,
        generationsUsed: true,
        generationsLimit: true,
        usageResetDate: true,
        overageUsed: true,
        overageCharges: true,
        lastBillingDate: true,
        freeTrialUsed: true,
        hasClaimedFreeTrial: true,
      }
    });
  } else {
    // Reset usage if past reset date
    if (user.usageResetDate && now > user.usageResetDate) {
      user = await prisma.user.update({
        where: { whopUserId },
        data: {
          generationsUsed: 0,
          overageUsed: 0,
          overageCharges: 0,
          usageResetDate: nextMonth,
          currentTier: userTier,
          generationsLimit: limit,
          lastBillingDate: now,
        },
        select: {
          id: true,
          whopUserId: true,
          currentTier: true,
          generationsUsed: true,
          generationsLimit: true,
          usageResetDate: true,
          overageUsed: true,
          overageCharges: true,
          lastBillingDate: true,
          freeTrialUsed: true,
          hasClaimedFreeTrial: true,
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
          overageUsed: true,
          overageCharges: true,
          lastBillingDate: true,
          freeTrialUsed: true,
          hasClaimedFreeTrial: true,
        }
      });
    }
  }

  const overageCentsPerGen = getOverageCents(userTier as PlanTier);
  
  return {
    hasAccess: true,
    tier: userTier,
    usage: {
      used: user.generationsUsed,
      limit: user.generationsLimit || limit,
      remaining: Math.max((user.generationsLimit || limit) - user.generationsUsed, 0),
      resetDate: user.usageResetDate,
      overageUsed: user.overageUsed,
      overageCharges: user.overageCharges,
      overageCentsPerGen: overageCentsPerGen,
      lastBillingDate: user.lastBillingDate,
      freeTrialUsed: user.freeTrialUsed,
      hasClaimedFreeTrial: user.hasClaimedFreeTrial,
    }
  };
}

export async function incrementUsage(whopUserId: string): Promise<boolean> {
  try {
    // Get current user state
    const user = await prisma.user.findUnique({
      where: { whopUserId },
      select: {
        generationsUsed: true,
        generationsLimit: true,
        currentTier: true,
        overageUsed: true,
        overageCharges: true,
        freeTrialUsed: true,
        hasClaimedFreeTrial: true,
      }
    });

    if (!user) {
      console.error('User not found for increment:', whopUserId);
      return false;
    }

    const limit = user.generationsLimit || 0;
    const hasActiveSubscription = user.currentTier && limit > 0;
    
    // Priority 1: If user has active subscription, use plan limit first
    if (hasActiveSubscription) {
      // Check if user is at or over their plan limit
      if (user.generationsUsed >= limit) {
        // User is in overage - charge per generation
        const overageCents = getOverageCents((user.currentTier || 'starter') as PlanTier);
        const overageCharge = overageCents / 100; // Convert cents to dollars
        
        await prisma.user.update({
          where: { whopUserId },
          data: {
            overageUsed: { increment: 1 },
            overageCharges: { increment: overageCharge },
          }
        });
        
        console.log(`📊 Overage usage incremented for ${whopUserId}: +$${overageCharge.toFixed(2)} (total: ${user.overageUsed + 1} extra gens)`);
      } else {
        // Normal usage within plan limit
        await prisma.user.update({
          where: { whopUserId },
          data: {
            generationsUsed: { increment: 1 },
          }
        });
        
        console.log(`📊 Usage incremented for ${whopUserId}: ${user.generationsUsed + 1}/${limit}`);
      }
    }
    // Priority 2: If no active subscription, use free trial
    else if (user.freeTrialUsed > 0) {
      await prisma.user.update({
        where: { whopUserId },
        data: {
          freeTrialUsed: { decrement: 1 },
          hasClaimedFreeTrial: true,
        }
      });
      
      console.log(`🎁 Free trial usage: ${10 - user.freeTrialUsed + 1}/10 used (${user.freeTrialUsed - 1} remaining)`);
    }
    // Priority 3: No subscription and no free trial (shouldn't reach here if access check works)
    else {
      console.error(`❌ User has no subscription and no free trial: ${whopUserId}`);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Failed to increment usage:', err);
    return false;
  }
}

