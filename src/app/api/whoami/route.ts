import { NextRequest, NextResponse } from 'next/server';
import { requireMemberOrAdmin } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    const gate = await requireMemberOrAdmin();
    
    return NextResponse.json({
      allowed: gate.allowed,
      reason: gate.reason,
      session: gate.session ? {
        userId: gate.session.userId,
        membershipId: gate.session.membershipId,
        status: gate.session.status,
      } : null,
    });
  } catch (error) {
    console.error('Whoami error:', error);
    return NextResponse.json({
      allowed: false,
      reason: 'error',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}