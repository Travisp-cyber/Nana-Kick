import { prisma } from '@/lib/prisma';

/**
 * Whop Overage Billing Handler
 * 
 * This module handles billing for overage usage (generations beyond plan limits).
 * Currently implements manual billing - overage charges are tracked and need to be
 * manually billed through Whop dashboard.
 * 
 * Future: Can be upgraded to use Whop's usage-based billing API if/when available.
 */

/**
 * Get all users with pending overage charges
 * 
 * Returns users who have accumulated overage charges that need to be billed.
 * This is typically called at the end of each billing cycle.
 */
export async function getUsersWithPendingOverage() {
  const users = await prisma.user.findMany({
    where: {
      overageCharges: {
        gt: 0
      }
    },
    select: {
      id: true,
      whopUserId: true,
      email: true,
      name: true,
      currentTier: true,
      overageUsed: true,
      overageCharges: true,
      lastBillingDate: true,
      usageResetDate: true,
    },
    orderBy: {
      overageCharges: 'desc'
    }
  });

  return users;
}

/**
 * Get overage billing summary
 * 
 * Returns aggregate statistics about overage usage and charges.
 * Useful for admin dashboard and revenue reporting.
 */
export async function getOverageBillingSummary() {
  const users = await getUsersWithPendingOverage();
  
  const totalRevenue = users.reduce((sum, user) => sum + user.overageCharges, 0);
  const totalGenerations = users.reduce((sum, user) => sum + user.overageUsed, 0);
  const averageCharge = users.length > 0 ? totalRevenue / users.length : 0;
  
  // Group by tier
  const byTier = users.reduce((acc, user) => {
    const tier = user.currentTier || 'unknown';
    if (!acc[tier]) {
      acc[tier] = {
        count: 0,
        totalCharges: 0,
        totalGenerations: 0
      };
    }
    acc[tier].count++;
    acc[tier].totalCharges += user.overageCharges;
    acc[tier].totalGenerations += user.overageUsed;
    return acc;
  }, {} as Record<string, { count: number; totalCharges: number; totalGenerations: number }>);
  
  return {
    totalUsers: users.length,
    totalRevenue,
    totalGenerations,
    averageCharge,
    byTier,
    users: users.map(u => ({
      whopUserId: u.whopUserId,
      email: u.email || 'N/A',
      name: u.name || 'N/A',
      tier: u.currentTier || 'unknown',
      overageUsed: u.overageUsed,
      overageCharges: u.overageCharges,
      lastBillingDate: u.lastBillingDate?.toISOString() || null,
    }))
  };
}

/**
 * Mark overage as billed and reset counters
 * 
 * This should be called AFTER you've manually billed the user through Whop dashboard.
 * It resets the overage counters and updates the last billing date.
 * 
 * @param whopUserId - The Whop user ID
 * @returns The amount that was billed (for record keeping)
 */
export async function markOverageAsBilled(whopUserId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { whopUserId },
    select: {
      overageCharges: true,
      overageUsed: true,
    }
  });

  if (!user || user.overageCharges <= 0) {
    return 0;
  }

  const billedAmount = user.overageCharges;

  await prisma.user.update({
    where: { whopUserId },
    data: {
      overageUsed: 0,
      overageCharges: 0,
      lastBillingDate: new Date(),
    }
  });

  console.log(`[Billing] Marked overage as billed for ${whopUserId}: $${billedAmount.toFixed(2)} (${user.overageUsed} gens)`);

  return billedAmount;
}

/**
 * Reset overage for all users (typically called during monthly reset)
 * 
 * This is automatically called by the monthly reset cron job.
 * It records any pending charges before resetting.
 * 
 * @returns Summary of what was reset
 */
export async function resetAllOverage() {
  const usersToBill = await getUsersWithPendingOverage();
  
  if (usersToBill.length === 0) {
    return {
      usersReset: 0,
      totalRevenue: 0,
      message: 'No users with pending overage charges'
    };
  }

  // Log for manual billing
  console.log('[Billing] Users with pending overage charges:');
  usersToBill.forEach(user => {
    console.log(`  - ${user.whopUserId} (${user.email}): $${user.overageCharges.toFixed(2)} for ${user.overageUsed} extra gens`);
  });

  const totalRevenue = usersToBill.reduce((sum, user) => sum + user.overageCharges, 0);

  // Reset all overage counters
  await prisma.user.updateMany({
    where: {
      overageCharges: {
        gt: 0
      }
    },
    data: {
      overageUsed: 0,
      overageCharges: 0,
      lastBillingDate: new Date(),
    }
  });

  return {
    usersReset: usersToBill.length,
    totalRevenue,
    message: `Reset overage for ${usersToBill.length} users. Total to bill: $${totalRevenue.toFixed(2)}`,
    users: usersToBill.map(u => ({
      whopUserId: u.whopUserId,
      email: u.email,
      amount: u.overageCharges,
      generations: u.overageUsed
    }))
  };
}

/**
 * Export overage billing data as CSV format
 * 
 * Useful for importing into billing systems or for manual processing.
 * 
 * @returns CSV string with overage billing data
 */
export async function exportOverageBillingCSV(): Promise<string> {
  const users = await getUsersWithPendingOverage();
  
  const header = 'Whop User ID,Email,Name,Tier,Overage Generations,Overage Charges (USD),Last Billing Date\n';
  const rows = users.map(u => 
    `${u.whopUserId},${u.email || 'N/A'},${u.name || 'N/A'},${u.currentTier || 'unknown'},${u.overageUsed},${u.overageCharges.toFixed(2)},${u.lastBillingDate?.toISOString() || 'Never'}`
  ).join('\n');
  
  return header + rows;
}

/**
 * Get overage billing data for a specific user
 * 
 * @param whopUserId - The Whop user ID
 * @returns User's overage billing details
 */
export async function getUserOverageBilling(whopUserId: string) {
  const user = await prisma.user.findUnique({
    where: { whopUserId },
    select: {
      whopUserId: true,
      email: true,
      name: true,
      currentTier: true,
      overageUsed: true,
      overageCharges: true,
      lastBillingDate: true,
      generationsUsed: true,
      generationsLimit: true,
      usageResetDate: true,
    }
  });

  if (!user) {
    return null;
  }

  return {
    user: {
      whopUserId: user.whopUserId,
      email: user.email || 'N/A',
      name: user.name || 'N/A',
      tier: user.currentTier || 'unknown',
    },
    usage: {
      includedUsed: user.generationsUsed,
      includedLimit: user.generationsLimit || 0,
      overageUsed: user.overageUsed,
      resetDate: user.usageResetDate?.toISOString() || null,
    },
    billing: {
      overageCharges: user.overageCharges,
      lastBillingDate: user.lastBillingDate?.toISOString() || null,
      needsBilling: user.overageCharges > 0,
    }
  };
}

