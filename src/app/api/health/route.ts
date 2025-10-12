import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health Check Endpoint
 * 
 * Verifies that all critical services are configured and accessible.
 * Useful for monitoring and debugging.
 * 
 * Returns:
 * - 200 OK if all checks pass
 * - 503 Service Unavailable if any critical service fails
 */
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {
      database: { status: 'unknown', message: '' },
      googleAI: { status: 'unknown', message: '' },
      whopAPI: { status: 'unknown', message: '' },
      environment: { status: 'unknown', message: '' }
    }
  };

  let allHealthy = true;

  // Check 1: Database Connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.services.database = {
      status: 'healthy',
      message: 'Database connection successful'
    };
  } catch (error) {
    checks.services.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed'
    };
    allHealthy = false;
  }

  // Check 2: Google AI API Key
  if (process.env.GOOGLE_AI_API_KEY && process.env.GOOGLE_AI_API_KEY !== 'your_api_key_here') {
    checks.services.googleAI = {
      status: 'healthy',
      message: 'Google AI API key configured'
    };
  } else {
    checks.services.googleAI = {
      status: 'unhealthy',
      message: 'Google AI API key not configured'
    };
    allHealthy = false;
  }

  // Check 3: Whop API Configuration
  const whopChecks = {
    appId: !!process.env.NEXT_PUBLIC_WHOP_APP_ID,
    apiKey: !!process.env.WHOP_API_KEY,
    webhookSecret: !!process.env.WHOP_WEBHOOK_SECRET,
    companyId: !!process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
    accessPasses: {
      starter: !!process.env.NEXT_PUBLIC_ACCESS_PASS_STARTER_ID,
      creator: !!process.env.NEXT_PUBLIC_ACCESS_PASS_CREATOR_ID,
      pro: !!process.env.NEXT_PUBLIC_ACCESS_PASS_PRO_ID,
      brand: !!process.env.NEXT_PUBLIC_ACCESS_PASS_BRAND_ID
    },
    plans: {
      starter: !!process.env.NEXT_PUBLIC_WHOP_PLAN_STARTER_ID,
      creator: !!process.env.NEXT_PUBLIC_WHOP_PLAN_CREATOR_ID,
      pro: !!process.env.NEXT_PUBLIC_WHOP_PLAN_PRO_ID,
      brand: !!process.env.NEXT_PUBLIC_WHOP_PLAN_BRAND_ID
    }
  };

  const whopConfigured = whopChecks.appId && whopChecks.apiKey && whopChecks.webhookSecret && whopChecks.companyId;
  const allAccessPasses = Object.values(whopChecks.accessPasses).every(Boolean);
  const allPlans = Object.values(whopChecks.plans).every(Boolean);

  if (whopConfigured && allAccessPasses && allPlans) {
    checks.services.whopAPI = {
      status: 'healthy',
      message: 'Whop API fully configured'
    };
  } else {
    const missing = [];
    if (!whopChecks.appId) missing.push('APP_ID');
    if (!whopChecks.apiKey) missing.push('API_KEY');
    if (!whopChecks.webhookSecret) missing.push('WEBHOOK_SECRET');
    if (!whopChecks.companyId) missing.push('COMPANY_ID');
    if (!allAccessPasses) missing.push('ACCESS_PASSES');
    if (!allPlans) missing.push('PLAN_IDS');

    checks.services.whopAPI = {
      status: 'unhealthy',
      message: `Whop API incomplete. Missing: ${missing.join(', ')}`
    };
    allHealthy = false;
  }

  // Check 4: Environment Variables
  const envChecks = {
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasCronSecret: !!process.env.CRON_SECRET,
    hasAdminIds: !!process.env.ADMIN_WHOP_USER_IDS
  };

  if (envChecks.hasDatabaseUrl && envChecks.hasDirectUrl) {
    checks.services.environment = {
      status: 'healthy',
      message: `Environment: ${envChecks.nodeEnv || 'unknown'}`
    };
  } else {
    checks.services.environment = {
      status: 'unhealthy',
      message: 'Missing critical environment variables'
    };
    allHealthy = false;
  }

  // Set overall status
  checks.status = allHealthy ? 'healthy' : 'unhealthy';

  // Return appropriate status code
  const statusCode = allHealthy ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}

