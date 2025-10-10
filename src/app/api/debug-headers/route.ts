import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(_request: NextRequest) {
  try {
    const h = await headers();
    
    // Convert headers to a plain object for easy inspection
    const allHeaders: Record<string, string> = {};
    h.forEach((value, key) => {
      allHeaders[key] = value;
    });

    // Specifically look for Whop-related headers
    const whopHeaders: Record<string, string> = {};
    const whopPrefixes = ['whop', 'x-whop', 'authorization'];
    
    Object.entries(allHeaders).forEach(([key, value]) => {
      if (whopPrefixes.some(prefix => key.toLowerCase().includes(prefix))) {
        whopHeaders[key] = value;
      }
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      message: 'Raw headers debug - access this through Whop iframe as promo user',
      totalHeaders: Object.keys(allHeaders).length,
      whopHeadersFound: Object.keys(whopHeaders).length,
      whopHeaders,
      allHeaders
    });

  } catch (error) {
    console.error('Headers debug error:', error);
    return NextResponse.json({
      error: 'Failed to read headers',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}