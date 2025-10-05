import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { whopSdk } from "@/lib/whop-sdk";

// Debug webhook handler to identify issues
export async function POST(req: NextRequest) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    headers: {},
    env: {},
    body: null,
    errors: [],
    steps: [],
  };

  try {
    // Step 1: Check headers
    debugInfo.steps.push("1. Checking headers");
    debugInfo.headers = {
      "content-type": req.headers.get("content-type"),
      "x-whop-signature": req.headers.get("x-whop-signature") ? "present" : "missing",
      "user-agent": req.headers.get("user-agent"),
    };

    // Step 2: Check environment variables
    debugInfo.steps.push("2. Checking environment variables");
    debugInfo.env = {
      WHOP_WEBHOOK_SECRET: process.env.WHOP_WEBHOOK_SECRET ? "configured" : "missing",
      WHOP_API_KEY: process.env.WHOP_API_KEY ? "configured" : "missing",
      DATABASE_URL: process.env.DATABASE_URL ? "configured" : "missing",
    };

    // Step 3: Parse body
    debugInfo.steps.push("3. Parsing request body");
    const body = await req.json();
    debugInfo.body = {
      event: body.event,
      dataKeys: Object.keys(body.data || {}),
      hasData: !!body.data,
    };

    // Step 4: Test database connection
    debugInfo.steps.push("4. Testing database connection");
    try {
      const count = await prisma.user.count();
      debugInfo.databaseConnected = true;
      debugInfo.userCount = count;
    } catch (dbError: any) {
      debugInfo.databaseConnected = false;
      debugInfo.databaseError = dbError.message;
      debugInfo.errors.push(`Database error: ${dbError.message}`);
    }

    // Step 5: Test Whop SDK
    debugInfo.steps.push("5. Testing Whop SDK");
    if (process.env.WHOP_API_KEY) {
      try {
        // Try to get company info
        const testCall = await whopSdk.app.retrieveCompanyByID({
          companyId: process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || "test",
        }).catch(err => ({ error: err.message }));
        
        debugInfo.whopSdkWorking = !testCall.error;
        if (testCall.error) {
          debugInfo.whopSdkError = testCall.error;
          debugInfo.errors.push(`Whop SDK error: ${testCall.error}`);
        }
      } catch (sdkError: any) {
        debugInfo.whopSdkWorking = false;
        debugInfo.whopSdkError = sdkError.message;
        debugInfo.errors.push(`Whop SDK error: ${sdkError.message}`);
      }
    } else {
      debugInfo.whopSdkWorking = false;
      debugInfo.whopSdkError = "API key not configured";
    }

    // Step 6: Try to create a test record
    if (debugInfo.databaseConnected) {
      debugInfo.steps.push("6. Testing database write");
      try {
        const testUser = await prisma.user.create({
          data: {
            whopUserId: `debug-test-${Date.now()}`,
            email: `debug-${Date.now()}@test.com`,
            name: "Debug Test User",
          },
        });
        debugInfo.databaseWriteSuccess = true;
        debugInfo.testUserId = testUser.id;
        
        // Clean up test user
        await prisma.user.delete({
          where: { id: testUser.id },
        });
        debugInfo.steps.push("7. Cleanup successful");
      } catch (writeError: any) {
        debugInfo.databaseWriteSuccess = false;
        debugInfo.databaseWriteError = writeError.message;
        debugInfo.errors.push(`Database write error: ${writeError.message}`);
      }
    }

    // Step 7: Check webhook signature validation
    debugInfo.steps.push("8. Checking webhook signature");
    if (!process.env.WHOP_WEBHOOK_SECRET) {
      debugInfo.signatureValidation = "skipped - no secret configured";
      debugInfo.errors.push("Webhook secret not configured - signature validation disabled");
    } else if (!req.headers.get("x-whop-signature")) {
      debugInfo.signatureValidation = "failed - no signature header";
      debugInfo.errors.push("No webhook signature in request");
    } else {
      debugInfo.signatureValidation = "secret configured and signature present";
    }

    // Summary
    debugInfo.summary = {
      webhookReady: debugInfo.env.WHOP_WEBHOOK_SECRET === "configured",
      databaseReady: debugInfo.databaseConnected && debugInfo.databaseWriteSuccess,
      whopApiReady: debugInfo.whopSdkWorking,
      canProcessEvents: debugInfo.errors.length === 0,
    };

    console.log("Webhook Debug Info:", JSON.stringify(debugInfo, null, 2));

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      recommendation: getRecommendation(debugInfo),
    });
  } catch (error: any) {
    debugInfo.errors.push(`Fatal error: ${error.message}`);
    console.error("Webhook debug error:", error);
    
    return NextResponse.json({
      success: false,
      debug: debugInfo,
      error: error.message,
    }, { status: 500 });
  }
}

function getRecommendation(debugInfo: any): string {
  if (!debugInfo.env.WHOP_WEBHOOK_SECRET) {
    return "Add WHOP_WEBHOOK_SECRET to your environment variables in Vercel";
  }
  if (!debugInfo.databaseConnected) {
    return "Check DATABASE_URL configuration - database connection failed";
  }
  if (!debugInfo.whopSdkWorking) {
    return "Check WHOP_API_KEY configuration - Whop API calls are failing";
  }
  if (debugInfo.errors.length > 0) {
    return `Fix these errors: ${debugInfo.errors.join(", ")}`;
  }
  return "Webhook is properly configured and ready to process events";
}