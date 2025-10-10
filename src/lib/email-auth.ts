import { prisma } from '@/lib/prisma';

// Alternative auth method using email-based membership (from webhooks)
export async function checkEmailMembership(email: string): Promise<boolean> {
  if (!email) return false;
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        usageResetDate: true,
        generationsLimit: true,
      }
    });
    
    if (!user) return false;
    
    // Check if user has active membership (reset date in future)
    const now = new Date();
    const hasActiveRenewal = user.usageResetDate ? user.usageResetDate > now : false;
    const hasLimit = (user.generationsLimit || 0) > 0;
    
    return hasActiveRenewal && hasLimit;
  } catch (error) {
    console.error('Email membership check failed:', error);
    return false;
  }
}

// Check if email has any membership record (even expired)
export async function getEmailMembership(email: string) {
  if (!email) return null;
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        currentTier: true,
        generationsUsed: true,
        generationsLimit: true,
        usageResetDate: true,
      }
    });
    
    return user;
  } catch (error) {
    console.error('Get email membership failed:', error);
    return null;
  }
}