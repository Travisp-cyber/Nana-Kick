import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);

  // Log incoming requests for debugging
  console.log(`[Middleware] ${request.method} ${request.url}`);
  
  // Get origin and referer
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  
  console.log(`[Middleware] Origin: ${origin}, Referer: ${referer}`);
  
  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    
    // List of allowed origins
    const allowedOrigins = [
      'https://whop.com',
      'https://www.whop.com',
      'https://bwpmv70igim3vgcd1rom.apps.whop.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://nana-kick.vercel.app'
    ];
    
    // Check if origin or referer is from Whop or allowed origins
    const isAllowedOrigin = allowedOrigins.some(allowed => 
      origin.includes(allowed) || referer.includes(allowed)
    );
    
    const isWhopRequest = origin.includes('whop.com') || referer.includes('whop.com');
    
    // Set CORS headers based on the request origin
    if (isWhopRequest || isAllowedOrigin) {
      // For Whop requests, allow the specific origin
      const corsOrigin = origin || referer.split('/').slice(0, 3).join('/');
      response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    } else {
      // For other requests, allow all origins (for development)
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: response.headers });
    }
    
    return response;
  }

  // For non-API routes, just pass through
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};