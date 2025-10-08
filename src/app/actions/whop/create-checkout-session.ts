"use server";

import { whopSdk } from "@/lib/whop-sdk";

/**
 * Create a Whop checkout session on the server.
 * Pass the returned session object directly to iframeSdk.inAppPurchase(session) on the client.
 */
export async function createCheckoutSession(input: { planId: string; metadata?: Record<string, string> }) {
  const { planId, metadata } = input;

  if (!planId) {
    throw new Error("Missing planId");
  }

  if (!process.env.NEXT_PUBLIC_WHOP_APP_ID) {
    throw new Error("NEXT_PUBLIC_WHOP_APP_ID is not configured");
  }
  if (!process.env.WHOP_API_KEY) {
    throw new Error("WHOP_API_KEY is not configured");
  }

  const session = await whopSdk.payments.createCheckoutSession({
    planId,
    metadata,
  });

  return session;
}