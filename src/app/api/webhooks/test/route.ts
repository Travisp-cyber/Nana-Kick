import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Test endpoint to verify webhook setup
export async function GET(req: NextRequest) {
  try {
    // Test database connection
    const userCount = await prisma.user.count();
    const membershipCount = await prisma.membership.count();
    
    // Check environment variables
    const webhookConfigured = !!process.env.WHOP_WEBHOOK_SECRET;
    const apiKeyConfigured = !!process.env.WHOP_API_KEY;
    const appIdConfigured = !!process.env.NEXT_PUBLIC_WHOP_APP_ID;
    
    return NextResponse.json({
      status: 'ready',
      webhook_endpoint: `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/api/webhooks`,
      configuration: {
        webhook_secret_configured: webhookConfigured,
        api_key_configured: apiKeyConfigured,
        app_id_configured: appIdConfigured,
      },
      database: {
        connected: true,
        users: userCount,
        memberships: membershipCount,
      },
      instructions: {
        webhook_url: 'Use the webhook_endpoint URL above in your Whop dashboard',
        test_locally: 'Use ngrok to expose your local server for testing',
        verify_events: 'Check console logs when webhooks are received',
      },
    });
  } catch (error) {
    console.error('Webhook test error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      check: {
        database_connection: 'Make sure DATABASE_URL is set correctly',
        tables_created: 'Run the SQL migration in Supabase',
      },
    }, { status: 500 });
  }
}

// Test webhook receiver - simulates a webhook event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('Test webhook received:', {
      event: body.event || 'test.event',
      timestamp: new Date().toISOString(),
      data: body,
    });
    
    // Try to create a test access log
    if (body.test_database) {
      // Create a test user first if needed
      const testUser = await prisma.user.upsert({
        where: { whopUserId: 'test-user-whop-id' },
        create: {
          whopUserId: 'test-user-whop-id',
          email: 'test@example.com',
          name: 'Test User',
        },
        update: {},
      });
      
      await prisma.accessLog.create({
        data: {
          userId: testUser.id,
          resource: 'webhook_test',
          allowed: true,
          reason: 'Testing webhook integration',
          ipAddress: req.headers.get('x-forwarded-for') || 'test',
          userAgent: req.headers.get('user-agent'),
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test webhook processed successfully',
      received: body,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}