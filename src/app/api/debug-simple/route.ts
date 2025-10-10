import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET() {
  try {
    const h = await headers();
    
    // Just get basic info first
    const userToken = h.get('x-whop-user-token');
    const authHeader = h.get('authorization');
    
    let userId = null;
    let tokenError = null;
    
    // Try to parse token safely
    if (userToken) {
      try {
        const parts = userToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          userId = payload.sub || payload.userId || payload.user_id;
        }
      } catch (error) {
        tokenError = error instanceof Error ? error.message : String(error);
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      hasUserToken: !!userToken,
      hasAuthHeader: !!authHeader,
      tokenLength: userToken ? userToken.length : 0,
      userId,
      tokenError,
      tokenPreview: userToken ? userToken.substring(0, 50) + '...' : null
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}