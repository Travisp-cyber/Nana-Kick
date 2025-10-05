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
    });

    // Handle different webhook events
    switch (body.event) {
      case "app.installed":
        // Handle app installation
        await handleAppInstalled(body.data);
        break;
        
      case "app.uninstalled":
        // Handle app uninstallation
        await handleAppUninstalled(body.data);
        break;
        
      case "membership.went_valid":
        // Handle new membership or renewal
        await handleMembershipValid(body.data);
        break;
        
      case "membership.went_invalid":
        // Handle membership cancellation or expiration
        await handleMembershipInvalid(body.data);
        break;
        
      case "payment.completed":
        // Handle successful payment
        await handlePaymentCompleted(body.data);
        break;
        
      case "payment.failed":
        // Handle failed payment
        await handlePaymentFailed(body.data);
        break;
        
      default:
        console.log("Unhandled webhook event:", body.event);
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

async function handleMembershipValid(data: any) {
  try {
    // Fetch membership details from Whop API
    const membership = await whopSdk.app.retrieveMembershipByID({
      membershipId: data.membership_id,
    });
    
    if (!membership) {
      throw new Error("Membership not found");
    }
    
    // Create or update user
    const user = await prisma.user.upsert({
      where: { whopUserId: membership.user_id },
      create: {
        whopUserId: membership.user_id,
        email: membership.email,
        name: membership.username,
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
        name: "Company " + membership.company_id,
      },
      update: {},
    });
    
    // Create or update membership
    await prisma.membership.upsert({
      where: { whopMembershipId: data.membership_id },
      create: {
        whopMembershipId: data.membership_id,
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
    
    console.log("Membership activated:", data.membership_id);
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
