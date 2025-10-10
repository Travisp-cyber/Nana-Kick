import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    adminConfig: {
      adminList: (process.env.ADMIN_WHOP_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
      agentUserId: process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID,
    },
    checkoutUrls: {
      starter: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STARTER_URL || 'missing',
      creator: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_CREATOR_URL || 'missing',
      brand: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_BRAND_URL || 'missing',
      pro: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_URL || 'missing',
    },
    planIds: {
      starter: process.env.NEXT_PUBLIC_WHOP_PLAN_STARTER_ID || 'missing',
      creator: process.env.NEXT_PUBLIC_WHOP_PLAN_CREATOR_ID || 'missing', 
      brand: process.env.NEXT_PUBLIC_WHOP_PLAN_BRAND_ID || 'missing',
      pro: process.env.NEXT_PUBLIC_WHOP_PLAN_PRO_ID || 'missing',
    }
  });
}