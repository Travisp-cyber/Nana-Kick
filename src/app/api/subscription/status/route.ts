import { NextRequest, NextResponse } from 'next/server';
import { getWhopSession, hasActiveSubscription, getUserMembership } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Get current session
    const session = await getWhopSession();
    
    if (!session) {
      return NextResponse.json({
        authenticated: false,
        hasActiveSubscription: false,
        membership: null,
      });
    }
    
    // Check subscription status
    const hasSubscription = await hasActiveSubscription(session.userId);
    
    // Get membership details if subscribed
    let membership = null;
    if (hasSubscription) {
      membership = await getUserMembership(session.userId);
    }
    
    return NextResponse.json({
      authenticated: true,
      hasActiveSubscription: hasSubscription,
      membership: membership ? {
        id: membership.id,
        status: membership.status,
        expiresAt: membership.expiresAt,
        company: {
          id: membership.company.id,
          name: membership.company.name,
        },
        subscriptions: membership.subscriptions.map(sub => ({
          id: sub.id,
          status: sub.status,
          product: {
            id: sub.product.id,
            name: sub.product.name,
          },
          plan: sub.plan ? {
            id: sub.plan.id,
            name: sub.plan.name,
            price: sub.plan.price,
            currency: sub.plan.currency,
          } : null,
          validUntil: sub.validUntil,
          trialEndsAt: sub.trialEndsAt,
        })),
      } : null,
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}