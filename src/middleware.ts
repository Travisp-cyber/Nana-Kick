import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Convert a simple glob (with *) to RegExp
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

// Read allowed origins from env, support comma-separated values and wildcards
function getAllowedOrigins(): string[] {
  const defaults = [
    'https://whop.com',
    'https://www.whop.com',
    'https://*.apps.whop.com',
    process.env.NEXT_PUBLIC_APP_URL || 'https://nana-kick.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  const envList = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // De-dupe while preserving order
  return [...new Set([...envList, ...defaults])];
}

function originFromUrl(urlStr: string): string {
  try {
    return new URL(urlStr).origin;
  } catch {
    return '';
  }
}

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';

  // Clone the request headers
  const requestHeaders = new Headers(request.headers);

  if (isDev) console.log(`[Middleware] ${request.method} ${request.url}`);
  
  // Get origin and referer
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const refererOrigin = originFromUrl(referer);
  
  if (isDev) console.log(`[Middleware] Origin: ${origin}, Referer: ${referer}`);
  
  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next();

    // Always vary by Origin to avoid cache poisoning
    response.headers.set('Vary', 'Origin');

    const allowedOrigins = getAllowedOrigins();

    const isAllowed = allowedOrigins.some((pattern) =>
      globToRegExp(pattern).test(origin || refererOrigin)
    );

    // Set CORS headers based on the request origin
    if (isAllowed && (origin || refererOrigin)) {
      const corsOrigin = origin || refererOrigin;
      response.headers.set('Access-Control-Allow-Origin', corsOrigin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Accept, Content-Type, Authorization, X-Requested-With'
    );
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
