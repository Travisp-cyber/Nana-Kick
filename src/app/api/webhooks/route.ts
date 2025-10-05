import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { whopSdk } from "@/lib/whop-sdk";
import crypto from "crypto";

interface WebhookBody {
  event?: string;
  action?: string;
  resource?: string;
  resource_type?: string;
  type?: string;
  data?: Record<string, unknown>;
  membership_id?: string;
  user_id?: string;
  product_id?: string;
  company_id?: string;
  company_name?: string;
  email?: string;
  username?: string;
  valid?: boolean;
  purchase_id?: string;
  payment_id?: string;
  expires_at?: string;
  [key: string]: unknown;
}

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
    
    const body: WebhookBody = JSON.parse(payload);
    
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
                           (body.data?.payment_id as string)?.startsWith('pay_') ||
                           !!body.purchase_id;
    const isMembershipEvent = body.event?.startsWith('mem_') || 
                             (body.data?.membership_id as string)?.startsWith('mem_') ||
                             !!body.membership_id;
    
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

// Helper to safely extract string from unknown data
function getString(data: unknown, field: string): string | undefined {
  if (typeof data === 'object' && data !== null && field in data) {
    const value = (data as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

// Handler functions for different webhook events
async function handleAppInstalled(data: unknown) {
  try {
    const companyId = getString(data, 'company_id');
    if (!companyId) return;
    
    // Create or update company record
    await prisma.company.upsert({
      where: { whopCompanyId: companyId },
      create: {
        whopCompanyId: companyId,
        name: getString(data, 'company_name') || "Unknown Company",
      },
      update: {
        name: getString(data, 'company_name') || "Unknown Company",
      },
    });
    
    console.log("App installed for company:", companyId);
  } catch (error) {
    console.error("Error handling app installation:", error);
  }
}

async function handleAppUninstalled(data: unknown) {
  try {
    const companyId = getString(data, 'company_id');
    if (!companyId) return;
    
    // Update all memberships for this company to invalid
    await prisma.membership.updateMany({
      where: { 
        company: { whopCompanyId: companyId },
        status: "valid",
      },
      data: {
        status: "invalid",
        canceledAt: new Date(),
      },
    });
    
    console.log("App uninstalled for company:", companyId);
  } catch (error) {
    console.error("Error handling app uninstallation:", error);
  }
}

async function handlePurchaseEvent(body: WebhookBody) {
  try {
    console.log("Processing purchase event with body:", body);
    
    // Extract data based on Whop's webhook format
    const purchaseId = body.event; // e.g., 'pay_W9MentDx7FZ0dh'
    const membershipId = body.membership_id || getString(body.data, 'membership_id');
    const userId = body.user_id || getString(body.data, 'user_id');
    // const productId = body.product_id || getString(body.data, 'product_id'); // TODO: Use for product tracking
    const email = body.email || getString(body.data, 'email');
    
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
    const companyId = membershipDetails?.company_id || body.company_id || process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || '';
    
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
        name: body.username || getString(body.data, 'username') || finalEmail?.split('@')[0],
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

async function handleMembershipValid(data: unknown) {
  try {
    // Extract membership ID from various possible locations
    const membershipId = getString(data, 'membership_id') || getString(data, 'id') || getString(data, 'event');
    
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
        user_id: getString(data, 'user_id'),
        email: getString(data, 'email'),
        username: getString(data, 'username'),
        company_id: getString(data, 'company_id') || process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
        expires_at: getString(data, 'expires_at'),
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
      where: { whopCompanyId: membership.company_id || '' },
      create: {
        whopCompanyId: membership.company_id || '',
        name: getString(data, 'company_name') || "Company " + membership.company_id,
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

async function handleMembershipInvalid(data: unknown) {
  try {
    const membershipId = getString(data, 'membership_id');
    if (!membershipId) return;
    
    // Update membership status
    await prisma.membership.update({
      where: { whopMembershipId: membershipId },
      data: {
        status: "invalid",
        canceledAt: new Date(),
      },
    });
    
    // Update related subscriptions
    await prisma.subscription.updateMany({
      where: {
        membership: { whopMembershipId: membershipId },
        status: "active",
      },
      data: {
        status: "canceled",
      },
    });
    
    console.log("Membership deactivated:", membershipId);
  } catch (error) {
    console.error("Error handling membership deactivation:", error);
  }
}

async function handlePaymentCompleted(data: unknown) {
  try {
    const subscriptionId = getString(data, 'subscription_id');
    const paymentId = getString(data, 'payment_id');
    
    // Record payment in database
    if (subscriptionId && paymentId) {
      const amount = typeof (data as Record<string, unknown>)['amount'] === 'number' 
        ? (data as Record<string, unknown>)['amount'] as number 
        : 0;
        
      await prisma.payment.create({
        data: {
          whopPaymentId: paymentId,
          subscriptionId: subscriptionId,
          amount: amount,
          currency: getString(data, 'currency') || "USD",
          status: "completed",
          paymentMethod: getString(data, 'payment_method'),
          processedAt: new Date(),
        },
      });
    }
    
    console.log("Payment completed:", paymentId);
  } catch (error) {
    console.error("Error handling payment completion:", error);
  }
}

async function handlePaymentFailed(data: unknown) {
  try {
    const subscriptionId = getString(data, 'subscription_id');
    const paymentId = getString(data, 'payment_id');
    
    // Record failed payment
    if (subscriptionId && paymentId) {
      const amount = typeof (data as Record<string, unknown>)['amount'] === 'number' 
        ? (data as Record<string, unknown>)['amount'] as number 
        : 0;
        
      await prisma.payment.create({
        data: {
          whopPaymentId: paymentId,
          subscriptionId: subscriptionId,
          amount: amount,
          currency: getString(data, 'currency') || "USD",
          status: "failed",
          paymentMethod: getString(data, 'payment_method'),
          processedAt: new Date(),
        },
      });
    }
    
    console.log("Payment failed:", paymentId);
  } catch (error) {
    console.error("Error handling payment failure:", error);
  }
}