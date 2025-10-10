import { NextRequest, NextResponse } from 'next/server';
import { whopSdk } from '@/lib/whop-sdk';

export async function POST(request: NextRequest) {
  try {
    const { userId, companyId } = await request.json();
    
    if (!userId || !companyId) {
      return NextResponse.json({ 
        error: 'userId and companyId are required' 
      }, { status: 400 });
    }

    // Check if user has active memberships using Whop API
    const memberships = await whopSdk.memberships.listMemberships({
      companyId,
      filters: {
        userId,
        status: 'valid'
      }
    });

    const activeMemberships = memberships.data?.filter(m => 
      ['valid', 'active', 'trialing'].includes(m.status?.toLowerCase() || '')
    ) || [];

    return NextResponse.json({
      hasAccess: activeMemberships.length > 0,
      memberships: activeMemberships,
      membershipCount: activeMemberships.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Promo access check error:', error);
    return NextResponse.json({
      error: 'Failed to check promo access',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}