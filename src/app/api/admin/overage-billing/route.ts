import { NextRequest, NextResponse } from 'next/server';
import {
  getOverageBillingSummary,
  exportOverageBillingCSV,
  getUserOverageBilling,
  markOverageAsBilled
} from '@/lib/whop-billing';

/**
 * Admin Overage Billing API
 * 
 * Provides admin endpoints for managing overage billing:
 * - GET: View summary of all pending overage charges
 * - POST: Mark specific user's overage as billed
 * - GET with ?export=csv: Export billing data as CSV
 * - GET with ?user=userId: Get specific user's billing details
 */

export const runtime = 'nodejs';

/**
 * Check if user is admin
 */
function isAdmin(request: NextRequest): boolean {
  // Get user ID from Whop headers (you might need to adjust this based on your auth setup)
  const whopUserId = request.headers.get('x-whop-user-id');
  
  if (!whopUserId) {
    return false;
  }
  
  const adminList = (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const agent = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
  
  return adminList.includes(whopUserId) || (agent && whopUserId === agent);
}

/**
 * GET - View overage billing summary or export data
 */
export async function GET(request: NextRequest) {
  // Check admin access
  if (!isAdmin(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Admin access required' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const exportCsv = searchParams.get('export') === 'csv';
  const userId = searchParams.get('user');

  try {
    // Export CSV
    if (exportCsv) {
      const csv = await exportOverageBillingCSV();
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="overage-billing-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Get specific user's billing
    if (userId) {
      const userBilling = await getUserOverageBilling(userId);
      if (!userBilling) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(userBilling);
    }

    // Get summary
    const summary = await getOverageBillingSummary();
    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error fetching overage billing:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch overage billing',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Mark overage as billed for a specific user
 */
export async function POST(request: NextRequest) {
  // Check admin access
  if (!isAdmin(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { whopUserId } = body;

    if (!whopUserId) {
      return NextResponse.json(
        { error: 'Missing whopUserId' },
        { status: 400 }
      );
    }

    const billedAmount = await markOverageAsBilled(whopUserId);

    if (billedAmount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No overage charges to bill for this user',
        billedAmount: 0
      });
    }

    return NextResponse.json({
      success: true,
      message: `Marked $${billedAmount.toFixed(2)} as billed for user ${whopUserId}`,
      billedAmount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error marking overage as billed:', error);
    return NextResponse.json(
      {
        error: 'Failed to mark overage as billed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

