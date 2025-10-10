import { prisma } from './db';
import { headers } from 'next/headers';
import { whopSdk } from '@/lib/whop-sdk';
import { checkEmailMembership } from '@/lib/email-auth';

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
    
    // Try the SDK method first (if it works)
    try {
      const verifier = (whopSdk as unknown as { verifyUserToken?: (h: Headers) => Promise<unknown> }).verifyUserToken;
      if (verifier) {
        const tokenInfo = await verifier(h) as Record<string, unknown>;
        if (tokenInfo && tokenInfo.userId) {
          return {
            userId: String(tokenInfo.userId),
            membershipId: tokenInfo.membershipId || undefined,
            companyId: tokenInfo.companyId || undefined,
            isValid: true,
            status: tokenInfo.status || undefined,
            planId: tokenInfo.planId || undefined,
            currentPeriodEnd: tokenInfo.currentPeriodEnd || undefined,
          } as WhopSession;
        }
      }
    } catch (sdkError) {
      console.log('SDK verification failed, trying manual header parsing:', sdkError);
    }
    
    // Fallback: Parse headers manually
    const authHeader = h.get('authorization') || h.get('x-whop-authorization');
    const userIdHeader = h.get('x-whop-user-id');
    const membershipIdHeader = h.get('x-whop-membership-id');
    const statusHeader = h.get('x-whop-status');
    const userToken = h.get('x-whop-user-token');
    
    if (userIdHeader || authHeader || userToken) {
      // Extract user ID from headers or auth token
      let userId = userIdHeader;
      let membershipId = membershipIdHeader;
      let status = statusHeader;
      
      // Try to parse x-whop-user-token JWT
      if (!userId && userToken) {
        try {
          const parts = userToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            userId = payload.sub || payload.userId || payload.user_id;
            // JWT might contain membership info
            membershipId = membershipId || payload.membershipId || payload.membership_id;
            status = status || payload.status;
          }
        } catch (jwtError) {
          console.log('JWT parsing failed:', jwtError);
          // Token parsing failed, continue
        }
      }
      
      // Try authorization header
      if (!userId && authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '');
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.userId || payload.user_id || payload.sub;
        } catch {
          // Token parsing failed, continue without userId
        }
      }
      
      if (userId) {
        const session = {
          userId: String(userId),
          membershipId: membershipId || undefined,
          companyId: h.get('x-whop-company-id') || undefined,
          isValid: true,
          status: status as "active" | "canceled" | "expired" | "trialing" | "past_due" || undefined,
          planId: h.get('x-whop-plan-id') || undefined,
          currentPeriodEnd: h.get('x-whop-current-period-end') || undefined,
        } as WhopSession;
        
        // If we have a userId but no membership info, try to fetch it from Whop API
        if (!session.membershipId && !session.status) {
          try {
            console.log('Fetching membership info for user:', userId);
            // Use Whop API to check user's memberships for this company
            const whopApiKey = process.env.WHOP_API_KEY;
            const companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID;
            
            if (whopApiKey && companyId) {
              const membershipsResponse = await fetch(
                `https://api.whop.com/v2/memberships?user_id=${userId}&company_id=${companyId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${whopApiKey}`,
                    'Content-Type': 'application/json'
                  },
                  cache: 'no-store'
                }
              );
              
              if (membershipsResponse.ok) {
                const membershipsData = await membershipsResponse.json();
                const activeMemberships = membershipsData.data?.filter(
                  (m: Record<string, unknown>) => ['valid', 'active', 'trialing'].includes(String(m.status || '').toLowerCase())
                );
                
                if (activeMemberships && activeMemberships.length > 0) {
                  const membership = activeMemberships[0] as {
                    id?: string;
                    status?: string;
                    plan?: { id?: string };
                    current_period_end?: string;
                  };
                  session.membershipId = String(membership.id || '');
                  session.status = String(membership.status || '').toLowerCase() as "active" | "canceled" | "expired" | "trialing" | "past_due";
                  session.planId = String(membership.plan?.id || '');
                  session.currentPeriodEnd = String(membership.current_period_end || '');
                  console.log('Found active membership:', membership.id);
                }
              }
            }
          } catch (apiError) {
            console.log('Failed to fetch membership from Whop API:', apiError);
          }
        }
        
        return session;
      }
    }
    
    return null;
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
  const isDev = process.env.NODE_ENV !== 'production';

  if (session && (adminList.includes(session.userId) || (agent && session.userId === agent))) {
    return { allowed: true, reason: 'admin', session } as const;
  }

  // In development mode, allow access if no session (for local testing)
  if (!session && isDev) {
    console.log('🔧 Development mode: Allowing access without Whop session');
    return { allowed: true, reason: 'dev_mode', session: null } as const;
  }

  // If running outside Whop (no session) in production, block
  if (!session) {
    return { allowed: false, reason: 'no_session', session: null } as const;
  }

  // If the Whop token indicates an active/valid membership (or includes a membership id), allow
  if (isWhopStatusActive(session.status as string | undefined) || !!session.membershipId) {
    return { allowed: true, reason: 'whop_token', session } as const;
  }

  // Fallback to local database subscription check
  const hasSub = await hasActiveSubscription(session.userId);
  if (hasSub) {
    return { allowed: true, reason: 'member', session } as const;
  }
  
  // Final fallback: check email-based membership (from webhooks) for known user
  if (session.userId === 'user_tpT8rH4IQk1dn') {
    const emailMembership = await checkEmailMembership('tpark19.tp@gmail.com');
    if (emailMembership) {
      return { allowed: true, reason: 'email_member', session } as const;
    }
  }
  
  return { allowed: false, reason: 'no_subscription', session } as const;
}
