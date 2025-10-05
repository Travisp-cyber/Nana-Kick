import { NextRequest, NextResponse } from 'next/server';
import { requireSubscription } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resource, productId } = body;
    
    if (!resource) {
      return NextResponse.json(
        { error: 'Resource parameter is required' },
        { status: 400 }
      );
    }
    
    // Check subscription
    const { authorized, hasSubscription, session } = await requireSubscription(productId);
    
    if (!authorized || !session) {
      return NextResponse.json({
        allowed: false,
        reason: 'Not authenticated',
      }, { status: 401 });
    }
    
    if (!hasSubscription) {
      // Log access denial
      const user = await prisma.user.findUnique({
        where: { whopUserId: session.userId },
      });
      
      if (user) {
        await prisma.accessLog.create({
          data: {
            userId: user.id,
            resource,
            allowed: false,
            reason: 'No active subscription',
            ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
            userAgent: req.headers.get('user-agent'),
          },
        });
      }
      
      return NextResponse.json({
        allowed: false,
        reason: 'No active subscription',
        upgradeUrl: process.env.NEXT_PUBLIC_WHOP_PRODUCT_URL || 'https://whop.com',
      });
    }
    
    // Log successful access
    const user = await prisma.user.findUnique({
      where: { whopUserId: session.userId },
    });
    
    if (user) {
      await prisma.accessLog.create({
        data: {
          userId: user.id,
          resource,
          allowed: true,
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        },
      });
    }
    
    return NextResponse.json({
      allowed: true,
      userId: session.userId,
      membershipId: session.membershipId,
    });
  } catch (error) {
    console.error('Error checking access:', error);
    return NextResponse.json(
      { error: 'Failed to check access' },
      { status: 500 }
    );
  }
}