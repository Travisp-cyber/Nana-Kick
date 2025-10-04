import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasGoogleKey: !!process.env.GOOGLE_AI_API_KEY,
      hasWhopKey: !!process.env.WHOP_API_KEY
    }
  });
}