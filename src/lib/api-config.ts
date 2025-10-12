/**
 * API configuration for handling different environments
 * (local development, Vercel deployment, Whop iframe)
 */

export function getApiUrl(endpoint: string): string {
  // Server-side: use environment variable or localhost
  if (typeof window === 'undefined') {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}${endpoint}`;
  }

  // Client-side: detect environment
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
  const isInIframe = window.parent !== window;
  const hasWhopReferrer = document.referrer.includes('whop.com');
  const isWhopDomain = window.location.hostname.includes('.apps.whop.com');
  
  // In local development (not in iframe)
  if (isLocalhost && !isInIframe && !hasWhopReferrer) {
    return `${window.location.origin}${endpoint}`;
  }
  
  // If we're in Whop's iframe/domain, use the current origin
  // This ensures API calls go through Whop's proxy which adds auth headers
  if (isWhopDomain || isInIframe || hasWhopReferrer) {
    console.log('[API] Using current origin for Whop proxy:', window.location.origin);
    return `${window.location.origin}${endpoint}`;
  }
  
  // Fallback to production URL
  const productionUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nana-kick.vercel.app';
  return `${productionUrl}${endpoint}`;
}

/**
 * Debug logging for API calls
 */
export function debugApi(message: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[API] ${message}`, ...args);
  }
}