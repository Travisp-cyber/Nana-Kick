import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    // For now, just save a basic record to track the event
    try {
      // Extract basic info from the webhook
      const eventType = body.event || body.action || 'unknown';
      const membershipId = body.membership_id || body.data?.membership_id;
      const userId = body.user_id || body.data?.user_id;
      const email = body.email || body.data?.email;
      
      // If we have user info, create or update user
      if (userId || email) {
        const userWhopId = userId || `email-${email}`;
        await prisma.user.upsert({
          where: { whopUserId: userWhopId },
          create: {
            whopUserId: userWhopId,
            email: email,
            name: body.username || body.data?.username || email?.split('@')[0],
          },
          update: {
            email: email || undefined,
          },
        });
        
        console.log("User saved:", userWhopId);
      }
      
      // If it looks like a purchase event (starts with pay_), handle it
      if (typeof body.event === 'string' && body.event.startsWith('pay_') && membershipId) {
        const companyId = body.company_id || process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || 'default';
        
        // Ensure company exists
        const company = await prisma.company.upsert({
          where: { whopCompanyId: companyId },
          create: {
            whopCompanyId: companyId,
            name: body.company_name || "Default Company",
          },
          update: {},
        });
        
        // Get or create user
        const userWhopId = userId || `unknown-${Date.now()}`;
        const user = await prisma.user.upsert({
          where: { whopUserId: userWhopId },
          create: {
            whopUserId: userWhopId,
            email: email,
            name: body.username || email?.split('@')[0] || "Unknown User",
          },
          update: {},
        });
        
        // Create membership
        await prisma.membership.upsert({
          where: { whopMembershipId: membershipId },
          create: {
            whopMembershipId: membershipId,
            userId: user.id,
            companyId: company.id,
            status: "valid",
          },
          update: {
            status: "valid",
          },
        });
        
        console.log("Purchase processed:", { eventType, membershipId, userId: user.id });
      }
      
    } catch (dbError) {
      console.error("Database error:", dbError);
      // Don't fail the webhook, just log the error
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: true }); // Always return success to prevent retries
  }
}