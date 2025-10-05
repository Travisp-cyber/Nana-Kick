import { whopSdk } from './whop-sdk';
import { prisma } from './db';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export interface WhopSession {
  userId: string;
  membershipId?: string;
  companyId?: string;
  isValid: boolean;
}

// Get session from cookies (for server components)
export async function getWhopSession(): Promise<WhopSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('whop-session-token')?.value;
    
    if (!sessionToken) {
      return null;
    }
    
    // Validate session token with Whop API
    const session = await whopSdk.app.validateSession({ token: sessionToken });
    
    if (!session || !session.user_id) {
      return null;
    }
    
    return {
      userId: session.user_id,
      membershipId: session.membership_id,
      companyId: session.company_id,
      isValid: true,
    };
  } catch (error) {
    console.error('Error getting Whop session:', error);
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
    
    // If no local records, check with Whop API
    try {
      const memberships = await whopSdk.app.listMemberships({
        userId,
        valid: true,
      });
      
      return memberships && memberships.length > 0;
    } catch (apiError) {
      console.error('Error checking Whop API for memberships:', apiError);
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

// Sync user data from Whop
export async function syncUserFromWhop(whopUserId: string, membershipId?: string) {
  try {
    // Get user details from Whop
    const whopUser = await whopSdk.app.retrieveUserByID({ userId: whopUserId });
    
    if (!whopUser) {
      throw new Error('User not found in Whop');
    }
    
    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { whopUserId },
      create: {
        whopUserId,
        email: whopUser.email,
        name: whopUser.username || whopUser.name,
        avatarUrl: whopUser.profile_pic_url,
      },
      update: {
        email: whopUser.email || undefined,
        name: whopUser.username || whopUser.name || undefined,
        avatarUrl: whopUser.profile_pic_url || undefined,
      },
    });
    
    // If membershipId is provided, sync membership data
    if (membershipId) {
      const membership = await whopSdk.app.retrieveMembershipByID({ membershipId });
      
      if (membership) {
        // Ensure company exists
        const company = await prisma.company.upsert({
          where: { whopCompanyId: membership.company_id },
          create: {
            whopCompanyId: membership.company_id,
            name: 'Company ' + membership.company_id,
          },
          update: {},
        });
        
        // Update membership
        await prisma.membership.upsert({
          where: { whopMembershipId: membershipId },
          create: {
            whopMembershipId: membershipId,
            userId: user.id,
            companyId: company.id,
            status: membership.valid ? 'valid' : 'invalid',
            expiresAt: membership.expires_at ? new Date(membership.expires_at) : null,
          },
          update: {
            status: membership.valid ? 'valid' : 'invalid',
            expiresAt: membership.expires_at ? new Date(membership.expires_at) : null,
          },
        });
      }
    }
    
    return user;
  } catch (error) {
    console.error('Error syncing user from Whop:', error);
    throw error;
  }
}

// Middleware helper to check authentication
export async function requireAuth(request: NextRequest) {
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
export async function requireSubscription(request: NextRequest, productId?: string) {
  const { authorized, session } = await requireAuth(request);
  
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