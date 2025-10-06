import { prisma } from './db';

export interface WhopSession {
  userId: string;
  membershipId?: string;
  companyId?: string;
  isValid: boolean;
}

// Get session from cookies (for server components)
export async function getWhopSession(): Promise<WhopSession | null> {
  try {
    // For now, just return null - implement proper session handling later
    return null;
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

// Sync user data from Whop - simplified version without API calls
export async function syncUserFromWhop(whopUserId: string) {
  try {
    // For now, just return the existing user or create a placeholder
    const user = await prisma.user.upsert({
      where: { whopUserId },
      create: {
        whopUserId,
        email: null,
        name: 'User ' + whopUserId,
      },
      update: {},
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