/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWhopSignature, fetchWhopMembership, getRenewalDate } from "@/lib/whop-integration";
import { normalizeTier, getPoolLimit, type PlanTier } from "@/lib/subscription/plans";

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text().catch(() => "");

  // Verify signature in production
  const signatureOk = verifyWhopSignature(req, rawBody);
  console.log('Webhook signature check:', { signatureOk, nodeEnv: process.env.NODE_ENV });
  
  // Enforce signature verification in production
  if (!signatureOk && process.env.NODE_ENV === "production") {
    console.error('WEBHOOK SIGNATURE FAILED - rejecting request');
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = {};
  }

  try {
    console.log("[Whop Webhook] Received:", JSON.stringify(body, null, 2));

    // Extract basic info from the webhook
    const eventType: string = body.event || body.action || body.type || "unknown";
    const membershipId: string | undefined = body.membership_id || body.data?.membership_id || body.membership?.id;
    const userId: string | undefined = body.user_id || body.data?.user_id || body.user?.id;
    const email: string | undefined = body.email || body.data?.email || body.user?.email;

    // Upsert user if available
    try {
      if (userId || email) {
        const userWhopId = userId || `email-${email}`;
        await prisma.user.upsert({
          where: { whopUserId: userWhopId },
          create: {
            whopUserId: userWhopId,
            email: email ?? null,
            name: body.username || body.data?.username || email?.split('@')[0] || null,
          },
          update: {
            email: email ?? undefined,
          },
        });
        console.log("[Whop Webhook] User upserted:", userWhopId);
      }
    } catch (dbUserErr) {
      console.error("[Whop Webhook] User upsert error:", dbUserErr);
    }

    // If it looks like a purchase event (pay_*) and we have membershipId, ensure membership + company exist in Prisma
    try {
      if (typeof eventType === 'string' && eventType.startsWith('pay_') && membershipId) {
        const companyId = body.company_id || process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || 'default';

        const company = await prisma.company.upsert({
          where: { whopCompanyId: companyId },
          create: { whopCompanyId: companyId, name: body.company_name || "Default Company" },
          update: {},
        });

        const userWhopId = userId || `unknown-${Date.now()}`;
        const user = await prisma.user.upsert({
          where: { whopUserId: userWhopId },
          create: {
            whopUserId: userWhopId,
            email: email ?? null,
            name: body.username || email?.split('@')[0] || "Unknown User",
          },
          update: {},
        });

        await prisma.membership.upsert({
          where: { whopMembershipId: membershipId },
          create: {
            whopMembershipId: membershipId,
            userId: user.id,
            companyId: company.id,
            status: "valid",
          },
          update: { status: "valid" },
        });

        console.log("[Whop Webhook] Purchase processed:", { eventType, membershipId, userId: user.id });
      }
    } catch (dbPurchaseErr) {
      console.error("[Whop Webhook] Purchase upsert error:", dbPurchaseErr);
    }

    // Member creation/update in Supabase based on membership events
    try {
      const evt = String(eventType).toLowerCase();
      const isActivation = evt.includes('went_valid') || evt.includes('payment') || evt.includes('install');
      const isUpgradeOrRenewal = evt.includes('upgrade') || evt.includes('renew') || evt.includes('plan.updated');

      if ((isActivation || isUpgradeOrRenewal) && membershipId && email) {
        // Fetch latest membership from Whop to get plan/product and period end
        const membership = await fetchWhopMembership(membershipId).catch(() => null);
        const renewalDate = getRenewalDate(membership);
        const resolvedTier: PlanTier | null = normalizeTier(
          membership?.plan?.name || membership?.product?.name || body.plan?.name || body.product?.name || ''
        );
        const poolLimit = resolvedTier ? getPoolLimit(resolvedTier) : undefined;

        // Upsert user in Prisma: create if doesn't exist, update tier/limits if exists
        try {
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          
          await prisma.user.upsert({
            where: { email: email },
            update: {
              currentTier: resolvedTier || 'starter',
              generationsLimit: poolLimit ?? getPoolLimit('starter'),
              usageResetDate: renewalDate ? new Date(renewalDate) : nextMonth,
            },
            create: {
              whopUserId: membershipId, // Use membershipId as fallback
              email: email,
              currentTier: resolvedTier || 'starter',
              generationsUsed: 0,
              generationsLimit: poolLimit ?? getPoolLimit('starter'),
              usageResetDate: renewalDate ? new Date(renewalDate) : nextMonth,
            }
          });
          console.log('[Whop Webhook] User upserted for membership', membershipId, email);
        } catch (upsertErr) {
          console.error('[Whop Webhook] User upsert error:', upsertErr);
        }
      }
    } catch (memberErr) {
      console.error('[Whop Webhook] Member sync error:', memberErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Whop Webhook] Handler error:", error);
    // Always return success to prevent retries, but log for diagnostics
    return NextResponse.json({ success: true });
  }
}
