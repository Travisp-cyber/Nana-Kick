import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { whopSdk } from "@/lib/whop-sdk";
import crypto from "crypto";

// Verify webhook signature (implement this based on Whop's webhook security)
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature || !process.env.WHOP_WEBHOOK_SECRET) {
    console.warn("Missing webhook signature or secret");
    return true; // Allow in development, but should enforce in production
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WHOP_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get('x-whop-signature');
    
    // Verify webhook signature
    if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(payload, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    
    const body = JSON.parse(payload);
    
    // Log webhook event
    console.log("Webhook received:", {
      event: body.event,
      data: body.data,
      // Log the actual structure to understand Whop's format
      fullBody: body,
    });

    // Check if this is a Whop event with action/resource format
    const action = body.action || body.event;
    const resource = body.resource_type || body.resource || body.type;
    
    // Also check for specific IDs that indicate event types
    const isPurchaseEvent = body.event?.startsWith('pay_') || 
                           body.data?.payment_id?.startsWith('pay_') ||
                           body.purchase_id;
    const isMembershipEvent = body.event?.startsWith('mem_') || 
                             body.data?.membership_id?.startsWith('mem_') ||
                             body.membership_id;
    
    console.log("Event analysis:", {
      action,
      resource,
      isPurchaseEvent,
      isMembershipEvent,
    });

    // Handle different webhook events based on Whop's actual format
    if (action === "app.installed") {
      await handleAppInstalled(body.data || body);
    } else if (action === "app.uninstalled") {
      await handleAppUninstalled(body.data || body);
    } else if (action === "membership.went_valid" || (isMembershipEvent && body.valid === true)) {
      await handleMembershipValid(body.data || body);
    } else if (action === "membership.went_invalid" || (isMembershipEvent && body.valid === false)) {
      await handleMembershipInvalid(body.data || body);
    } else if (action === "payment.completed" || isPurchaseEvent) {
      await handlePaymentCompleted(body.data || body);
    } else if (action === "payment.failed") {
      await handlePaymentFailed(body.data || body);
    } else {
      // For now, if we get an event ID like 'pay_xxx', treat it as a purchase event
      if (typeof body.event === 'string' && body.event.startsWith('pay_')) {
        console.log("Processing purchase event:", body.event);
        await handlePurchaseEvent(body);
      } else {
        console.log("Unhandled webhook event:", { event: body.event, body });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 }
    );
  }
}

// Handler functions for different webhook events
async function handleAppInstalled(data: any) {
  try {
    // Create or update company record
    await prisma.company.upsert({
      where: { whopCompanyId: data.company_id },
      create: {
        whopCompanyId: data.company_id,
        name: data.company_name || "Unknown Company",
      },
      update: {
        name: data.company_name || "Unknown Company",
      },
    });
    
    console.log("App installed for company:", data.company_id);
  } catch (error) {
    console.error("Error handling app installation:", error);
  }
}

async function handleAppUninstalled(data: any) {
  try {
    // Update all memberships for this company to invalid
    await prisma.membership.updateMany({
      where: { 
        company: { whopCompanyId: data.company_id },
        status: "valid",
      },
      data: {
        status: "invalid",
        canceledAt: new Date(),
      },
    });
    
    console.log("App uninstalled for company:", data.company_id);
  } catch (error) {
    console.error("Error handling app uninstallation:", error);
  }
}

async function handlePurchaseEvent(body: any) {
  try {
    console.log("Processing purchase event with body:", body);
    
    // Extract data based on Whop's webhook format
    const purchaseId = body.event; // e.g., 'pay_W9MentDx7FZ0dh'
    const membershipId = body.membership_id || body.data?.membership_id;
    const userId = body.user_id || body.data?.user_id;
    const productId = body.product_id || body.data?.product_id;
    const email = body.email || body.data?.email;
    
    if (!membershipId) {
      console.warn("No membership ID in purchase event, skipping");
      return;
    }
    
    // Try to get membership details from Whop
    let membershipDetails;
    try {
      membershipDetails = await whopSdk.app.retrieveMembershipByID({
        membershipId: membershipId,
      });
    } catch (apiError) {
      console.error("Failed to fetch membership from Whop:", apiError);
    }
    
    // Use webhook data if API call fails
    const finalUserId = membershipDetails?.user_id || userId;
    const finalEmail = membershipDetails?.email || email;
    const companyId = membershipDetails?.company_id || body.company_id || process.env.NEXT_PUBLIC_WHOP_COMPANY_ID;
    
    if (!finalUserId) {
      console.error("No user ID found in purchase event");
      return;
    }
    
    // Create or update user
    const user = await prisma.user.upsert({
      where: { whopUserId: finalUserId },
      create: {
        whopUserId: finalUserId,
        email: finalEmail,
        name: body.username || body.data?.username || finalEmail?.split('@')[0],
      },
      update: {
        email: finalEmail || undefined,
      },
    });
    
    // Create or update company
    const company = await prisma.company.upsert({
      where: { whopCompanyId: companyId },
      create: {
        whopCompanyId: companyId,
        name: body.company_name || "Default Company",
      },
      update: {},
    });
    
    // Create or update membership
    await prisma.membership.upsert({
      where: { whopMembershipId: membershipId },
      create: {
        whopMembershipId: membershipId,
        userId: user.id,
        companyId: company.id,
        status: "valid",
        expiresAt: membershipDetails?.expires_at ? new Date(membershipDetails.expires_at) : null,
      },
      update: {
        status: "valid",
        canceledAt: null,
      },
    });
    
    console.log("Purchase processed successfully:", { purchaseId, membershipId, userId: user.id });
  } catch (error) {
    console.error("Error handling purchase event:", error);
  }
}

async function handleMembershipValid(data: any) {
  try {
    // Extract membership ID from various possible locations
    const membershipId = data.membership_id || data.id || data.event;
    
    if (!membershipId) {
      console.error("No membership ID found in data:", data);
      return;
    }
    
    // Fetch membership details from Whop API
    let membership;
    try {
      membership = await whopSdk.app.retrieveMembershipByID({
        membershipId: membershipId,
      });
    } catch (apiError) {
      console.error("Failed to fetch membership:", apiError);
      // Use data from webhook if API fails
      membership = {
        user_id: data.user_id,
        email: data.email,
        username: data.username,
        company_id: data.company_id || process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
        expires_at: data.expires_at,
      };
    }
    
    if (!membership || !membership.user_id) {
      throw new Error("Invalid membership data");
    }
    
    // Create or update user
    const user = await prisma.user.upsert({
      where: { whopUserId: membership.user_id },
      create: {
        whopUserId: membership.user_id,
        email: membership.email,
        name: membership.username || membership.email?.split('@')[0],
      },
      update: {
        email: membership.email || undefined,
        name: membership.username || undefined,
      },
    });
    
    // Create or update company
    const company = await prisma.company.upsert({
      where: { whopCompanyId: membership.company_id },
      create: {
        whopCompanyId: membership.company_id,
        name: data.company_name || "Company " + membership.company_id,
      },
      update: {},
    });
    
    // Create or update membership
    await prisma.membership.upsert({
      where: { whopMembershipId: membershipId },
      create: {
        whopMembershipId: membershipId,
        userId: user.id,
        companyId: company.id,
        status: "valid",
        expiresAt: membership.expires_at ? new Date(membership.expires_at) : null,
      },
      update: {
        status: "valid",
        expiresAt: membership.expires_at ? new Date(membership.expires_at) : null,
        canceledAt: null,
      },
    });
    
    console.log("Membership activated:", membershipId);
  } catch (error) {
    console.error("Error handling membership activation:", error);
  }
}

async function handleMembershipInvalid(data: any) {
  try {
    // Update membership status
    await prisma.membership.update({
      where: { whopMembershipId: data.membership_id },
      data: {
        status: "invalid",
        canceledAt: new Date(),
      },
    });
    
    // Update related subscriptions
    await prisma.subscription.updateMany({
      where: {
        membership: { whopMembershipId: data.membership_id },
        status: "active",
      },
      data: {
        status: "canceled",
      },
    });
    
    console.log("Membership deactivated:", data.membership_id);
  } catch (error) {
    console.error("Error handling membership deactivation:", error);
  }
}

async function handlePaymentCompleted(data: any) {
  try {
    // Record payment in database
    if (data.subscription_id && data.payment_id) {
      await prisma.payment.create({
        data: {
          whopPaymentId: data.payment_id,
          subscriptionId: data.subscription_id,
          amount: data.amount || 0,
          currency: data.currency || "USD",
          status: "completed",
          paymentMethod: data.payment_method,
          processedAt: new Date(),
        },
      });
    }
    
    console.log("Payment completed:", data.payment_id);
  } catch (error) {
    console.error("Error handling payment completion:", error);
  }
}

async function handlePaymentFailed(data: any) {
  try {
    // Record failed payment
    if (data.subscription_id && data.payment_id) {
      await prisma.payment.create({
        data: {
          whopPaymentId: data.payment_id,
          subscriptionId: data.subscription_id,
          amount: data.amount || 0,
          currency: data.currency || "USD",
          status: "failed",
          paymentMethod: data.payment_method,
          processedAt: new Date(),
        },
      });
    }
    
    console.log("Payment failed:", data.payment_id);
  } catch (error) {
    console.error("Error handling payment failure:", error);
  }
}
