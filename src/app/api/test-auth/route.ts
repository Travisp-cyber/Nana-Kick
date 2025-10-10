import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(_request: NextRequest) {
  try {
    const h = await headers();
    
    // Get all headers for debugging
    const headerObj: Record<string, string> = {};
    h.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // Check if we can find Whop-related headers
    const whopHeaders: Record<string, string> = {};
    Object.keys(headerObj).forEach(key => {
      if (key.toLowerCase().includes('whop') || 
          key.toLowerCase().includes('x-') || 
          key.toLowerCase().includes('authorization') ||
          key.toLowerCase().includes('user')) {
        whopHeaders[key] = headerObj[key];
      }
    });
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      hasWhopHeaders: Object.keys(whopHeaders).length > 0,
      whopHeaders,
      userAgent: headerObj['user-agent'],
      host: headerObj['host'],
      origin: headerObj['origin'],
      referer: headerObj['referer'],
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to read headers',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}