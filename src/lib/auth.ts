import { prisma } from './db';
import { headers } from 'next/headers';
import { whopSdk } from '@/lib/whop-sdk';

export interface WhopSession {
  userId: string;
  membershipId?: string;
  companyId?: string;
  isValid: boolean;
  status?: "active" | "canceled" | "expired" | "trialing" | "past_due";
  planId?: string;
  currentPeriodEnd?: Date | string;
}

// Resolve a Whop session from incoming request headers (works inside Whop iFrame)
export async function getWhopSession(): Promise<WhopSession | null> {
  try {
    const h = await headers();
    // The @whop/api SDK can verify headers and return the current user context
    type VerifyReturn = { userId?: string; membershipId?: string; companyId?: string; status?: string; planId?: string; currentPeriodEnd?: string } | null;
    const verifier = (whopSdk as unknown as { verifyUserToken?: (h: Headers) => Promise<VerifyReturn> }).verifyUserToken;
    const tokenInfo = verifier ? await verifier(h) : null;
    if (!tokenInfo || !tokenInfo.userId) return null;

    return {
      userId: String(tokenInfo.userId),
      membershipId: tokenInfo.membershipId || undefined,
      companyId: tokenInfo.companyId || undefined,
      isValid: true,
      status: tokenInfo.status || undefined,
      planId: tokenInfo.planId || undefined,
      currentPeriodEnd: tokenInfo.currentPeriodEnd || undefined,
    } as WhopSession;
  } catch {
    // In non-Whop contexts, this will fail; treat as no session
    return null;
  }
}

// Check if user has active subscription
export async function hasActiveSubscription(userId: string, productId?: string): Promise<boolean> {
  try {
    // First check our database
    const user = await prisma.user.findUnique({
      where: { whopUserId: userId },
      include: {
        memberships: {
          where: {
            status: 'valid',
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
        },
        subscriptions: {
          where: {
            status: 'active',
            ...(productId && { product: { whopProductId: productId } }),
            OR: [
              { validUntil: null },
              { validUntil: { gte: new Date() } },
            ],
          },
        },
      },
    });
    
    if (!user) {
      return false;
    }
    
    // Check if user has any valid memberships
    if (user.memberships.length > 0) {
      return true;
    }
    
    // Check if user has any active subscriptions
    if (user.subscriptions.length > 0) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

// Get user's membership details
export async function getUserMembership(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { whopUserId: userId },
      include: {
        memberships: {
          where: {
            status: 'valid',
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
          include: {
            company: true,
            subscriptions: {
              include: {
                product: true,
                plan: true,
              },
            },
          },
        },
      },
    });
    
    return user?.memberships[0] || null;
  } catch (error) {
    console.error('Error getting user membership:', error);
    return null;
  }
}

export type WhopSyncInput = {
  userId: string;
  membershipId?: string | null;
  status?: "active" | "canceled" | "expired" | "trialing" | "past_due";
  planId?: string | null;
  currentPeriodEnd?: Date | string | null;
};

// Sync user data from Whop
export async function syncUserFromWhop(input: WhopSyncInput) {
  const { userId, membershipId, status, planId, currentPeriodEnd } = input;
  
  try {
    const user = await prisma.user.upsert({
      where: { whopUserId: userId },
      update: {
        membershipId: membershipId ?? undefined,
        subscriptionStatus: status ?? undefined,
        planId: planId ?? undefined,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
      },
      create: {
        whopUserId: userId,
        email: null,
        name: 'User ' + userId,
        membershipId: membershipId ?? null,
        subscriptionStatus: status ?? "active",
        planId: planId ?? null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
      },
    });
    
    return user;
  } catch (error) {
    console.error('Error syncing user from Whop:', error);
    throw error;
  }
}

// Middleware helper to check authentication
export async function requireAuth() {
  const session = await getWhopSession();
  
  if (!session || !session.isValid) {
    return {
      authorized: false,
      session: null,
    };
  }
  
  return {
    authorized: true,
    session,
  };
}

// Middleware helper to check subscription
export async function requireSubscription(productId?: string) {
  const { authorized, session } = await requireAuth();
  
  if (!authorized || !session) {
    return {
      authorized: false,
      hasSubscription: false,
      session: null,
    };
  }
  
  const hasSubscription = await hasActiveSubscription(session.userId, productId);
  
  return {
    authorized: true,
    hasSubscription,
    session,
  };
}

// Treat certain Whop token statuses as active subscription
function isWhopStatusActive(status?: string | null) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s === 'active' || s === 'valid' || s === 'trialing' || s === 'past_due';
}

// Gate access: allow admins always; otherwise require active subscription
export async function requireMemberOrAdmin() {
  const session = await getWhopSession();
  const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;

  if (session && (adminList.includes(session.userId) || (agent && session.userId === agent))) {
    return { allowed: true, reason: 'admin', session } as const;
  }

  // If running outside Whop (no session), block
  if (!session) {
    return { allowed: false, reason: 'no_session', session: null } as const;
  }

  // If the Whop token indicates an active/valid membership (or includes a membership id), allow
  if (isWhopStatusActive(session.status as string | undefined) || !!session.membershipId) {
    return { allowed: true, reason: 'whop_token', session } as const;
  }

  // Fallback to local database subscription check
  const hasSub = await hasActiveSubscription(session.userId);
  return { allowed: hasSub, reason: hasSub ? 'member' : 'no_subscription', session } as const;
}
